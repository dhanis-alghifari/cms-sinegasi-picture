/**
 * Cross-worker idempotency response cache.
 *
 * Domain tables/RPCs remain the source of truth for exactly-once mutations.
 * This cache only prevents a completed response from being recomputed on a
 * retry. The default memory store is safe for one process; production can use
 * the Supabase adapter after migration 027 is applied.
 * Credential issuance opts out; this response cache is not an operation
 * ledger and cannot provide exactly-once credential creation/provisioning.
 * Signed upload/access URLs are bearer credentials too; reservation retries
 * must recover through their domain state rather than replay a cached URL.
 */

import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

export interface CachedResponse {
  statusCode: number;
  payload: string;
  expiresAt: number;
}

export interface IdempotencyStore {
  get(cacheKey: string, now?: number): Promise<CachedResponse | null> | CachedResponse | null;
  set(cacheKey: string, response: CachedResponse): Promise<void> | void;
}

interface IdempotencyContext {
  key: string;
  cacheKey: string;
  replayed: boolean;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 10_000;
const MAX_CACHED_PAYLOAD_BYTES = 256 * 1024;
const CREDENTIAL_RESPONSE_KEYS = new Set([
  'password',
  'passwordhash',
  'temporarypassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authorization',
  'secret',
  'clientsecret',
  'sessionsecret',
  'sessiontoken',
  'csrftoken',
  'apikey',
  'privatekey',
  'cookie',
  'setcookie',
  'uploadurl',
  'accessurl',
  'signedurl',
]);

function containsCredentials(value: unknown): boolean {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      for (const entry of current) pending.push(entry);
      continue;
    }
    for (const [key, entry] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
      if (CREDENTIAL_RESPONSE_KEYS.has(normalizedKey)) return true;
      pending.push(entry);
    }
  }
  return false;
}

function containsSerializedCredentials(payload: string): boolean {
  try {
    return containsCredentials(JSON.parse(payload) as unknown);
  } catch {
    // Text responses are not credentials merely because their prose contains
    // words such as "password". Credential routes also explicitly opt out.
    return false;
  }
}

function serializeResponsePayload(payload: unknown): string | undefined {
  if (typeof payload === 'string') return payload;
  if (Buffer.isBuffer(payload)) return payload.toString('utf8');
  try {
    return JSON.stringify(payload);
  } catch {
    return undefined;
  }
}

function cleanupExpiredEntries(cache: Map<string, CachedResponse>, now = Date.now()): void {
  for (const [key, cached] of cache) {
    if (cached.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
  const cache = new Map<string, CachedResponse>();
  return {
    get(cacheKey, now = Date.now()) {
      cleanupExpiredEntries(cache, now);
      const cached = cache.get(cacheKey);
      return cached && cached.expiresAt > now ? cached : null;
    },
    set(cacheKey, response) {
      cleanupExpiredEntries(cache);
      cache.set(cacheKey, response);
      cleanupExpiredEntries(cache);
    },
  };
}

type SupabaseLike = SupabaseClient | null;

export function createSupabaseIdempotencyStore(client: SupabaseLike, fallback = createMemoryIdempotencyStore()): IdempotencyStore {
  if (!client) return fallback;
  return {
    async get(cacheKey, now = Date.now()) {
      try {
        const { data, error } = await client
          .from('api_idempotency_responses')
          .select('status_code,payload,expires_at')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date(now).toISOString())
          .maybeSingle();
        if (!error && data) {
          return {
            statusCode: Number(data.status_code),
            payload: String(data.payload),
            expiresAt: Date.parse(data.expires_at),
          };
        }
        if (!error || ['42P01', 'PGRST205'].includes(error.code || '')) return fallback.get(cacheKey, now);
      } catch {
        // A missing migration or transient store failure must not take down
        // the API; domain-level idempotency still protects critical writes.
      }
      return fallback.get(cacheKey, now);
    },
    async set(cacheKey, response) {
      try {
        const { error } = await client.from('api_idempotency_responses').upsert({
          cache_key: cacheKey,
          status_code: response.statusCode,
          payload: response.payload,
          expires_at: new Date(response.expiresAt).toISOString(),
        }, { onConflict: 'cache_key' });
        if (!error) return;
      } catch {
        // Fall through to the process-local cache during rollout/outages.
      }
      fallback.set(cacheKey, response);
    },
  };
}

function getRawKey(request: FastifyRequest): string | undefined {
  const headerKey = request.headers['x-idempotency-key'];
  const body = request.body as Record<string, unknown> | undefined;
  const bodyKey = body?.idempotencyKey || body?.idempotency_key;
  const key = Array.isArray(headerKey) ? headerKey[0] : headerKey || bodyKey;
  return typeof key === 'string' ? key.trim() : undefined;
}

function normalizeForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForFingerprint);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, entry]) => [name, normalizeForFingerprint(entry)]),
  );
}

function getCacheKey(request: FastifyRequest, key: string): string | null {
  const user = request.user as { userId?: unknown; authVersion?: unknown } | undefined;
  if (typeof user?.userId !== 'string' || user.userId.length === 0) return null;

  const caller = crypto.createHash('sha256')
    .update(`${user.userId}:${String(user.authVersion ?? '')}`)
    .digest('hex');
  const keyDigest = crypto.createHash('sha256').update(key).digest('hex');
  const requestFingerprint = crypto.createHash('sha256')
    .update(JSON.stringify(normalizeForFingerprint({
      params: request.params,
      query: request.query,
      body: request.body,
      changeReason: request.headers['x-change-reason'],
    })) ?? '')
    .digest('hex');
  return `v2:${caller}:${request.method}:${request.routeOptions.url}:${requestFingerprint}:${keyDigest}`;
}

export function registerAuthorizedIdempotencyHook(
  fastify: FastifyInstance,
  authenticateHook: preHandlerHookHandler,
): void {
  fastify.addHook('onRoute', (routeOptions) => {
    const configuredHooks = routeOptions.preHandler;
    if (!configuredHooks) return;

    const preHandlers = Array.isArray(configuredHooks) ? configuredHooks : [configuredHooks];
    if (!preHandlers.includes(authenticateHook)) return;

    routeOptions.preHandler = [...preHandlers, idempotencyMiddleware];
  });
}

const defaultStore = createMemoryIdempotencyStore();
let activeStore: IdempotencyStore = defaultStore;

export function configureIdempotencyStore(store: IdempotencyStore): void {
  activeStore = store;
}

export async function idempotencyMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  const routeConfig = request.routeOptions.config as { disableIdempotencyCache?: boolean } | undefined;
  if (routeConfig?.disableIdempotencyCache) return;
  const key = getRawKey(request);
  if (!key) return;
  if (key.length < 8 || key.length > 128) {
    return reply.status(400).send({
      success: false,
      error: 'INVALID_IDEMPOTENCY_KEY',
      error_code: 'INVALID_IDEMPOTENCY_KEY',
      message: 'X-Idempotency-Key harus memiliki panjang 8 sampai 128 karakter.',
      request_id: reply.request.id,
    });
  }

  const cacheKey = getCacheKey(request, key);
  if (!cacheKey) return;
  const cached = await activeStore.get(cacheKey);
  (request as FastifyRequest & { idempotencyContext?: IdempotencyContext }).idempotencyContext = {
    key,
    cacheKey,
    replayed: Boolean(cached),
  };
  if (cached) {
    // Older deployments may already have cached credentials. Do not replay
    // those secrets or execute a known-completed mutation again. Removing
    // persisted legacy rows requires a separate, approved database operation.
    if (Buffer.byteLength(cached.payload, 'utf8') > MAX_CACHED_PAYLOAD_BYTES || containsSerializedCredentials(cached.payload)) {
      return reply.status(409).send({
        success: false,
        error: 'IDEMPOTENCY_RESPONSE_NOT_REPLAYABLE',
        error_code: 'IDEMPOTENCY_RESPONSE_NOT_REPLAYABLE',
        message: 'Permintaan ini sudah diproses. Respons sensitif tidak dapat ditampilkan ulang; periksa hasilnya sebelum mengulang tindakan.',
        request_id: reply.request.id,
      });
    }
    request.log.info({ keyHash: crypto.createHash('sha256').update(key).digest('hex') }, '[IDEMPOTENCY] Replaying cached response');
    return reply.status(cached.statusCode).send(cached.payload);
  }
}

export function getIdempotencyContext(request: FastifyRequest): IdempotencyContext | undefined {
  return (request as FastifyRequest & { idempotencyContext?: IdempotencyContext }).idempotencyContext;
}

export async function saveIdempotencyResponse(request: FastifyRequest, statusCode: number, payload: unknown): Promise<void> {
  const context = getIdempotencyContext(request);
  if (!context || context.replayed || statusCode < 200 || statusCode >= 300) return;
  const routeConfig = request.routeOptions.config as { disableIdempotencyCache?: boolean } | undefined;
  if (routeConfig?.disableIdempotencyCache) return;
  const serializedPayload = serializeResponsePayload(payload);
  if (serializedPayload === undefined) return;
  // Large exports/uploads should not be copied into a resilience cache. Their
  // domain idempotency keys still protect the mutation itself.
  if (Buffer.byteLength(serializedPayload, 'utf8') > MAX_CACHED_PAYLOAD_BYTES) return;
  // Defense in depth for future routes that forget their explicit opt-out.
  // Match JSON field names recursively, never user-entered keyword strings.
  if (containsSerializedCredentials(serializedPayload)) return;
  await activeStore.set(context.cacheKey, {
    statusCode,
    payload: serializedPayload,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}
