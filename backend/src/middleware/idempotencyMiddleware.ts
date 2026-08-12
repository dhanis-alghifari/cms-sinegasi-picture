/**
 * Cross-worker idempotency response cache.
 *
 * Domain tables/RPCs remain the source of truth for exactly-once mutations.
 * This cache only prevents a completed response from being recomputed on a
 * retry. The default memory store is safe for one process; production can use
 * the Supabase adapter after migration 027 is applied.
 */

import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';

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

function getCacheKey(request: FastifyRequest, key: string): string {
  const authorization = request.headers.authorization || 'anonymous';
  const caller = crypto.createHash('sha256').update(authorization).digest('hex');
  const keyDigest = crypto.createHash('sha256').update(key).digest('hex');
  return `${caller}:${request.method}:${request.routeOptions.url}:${keyDigest}`;
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
  const cached = await activeStore.get(cacheKey);
  (request as FastifyRequest & { idempotencyContext?: IdempotencyContext }).idempotencyContext = {
    key,
    cacheKey,
    replayed: Boolean(cached),
  };
  if (cached) {
    request.log.info({ keyHash: crypto.createHash('sha256').update(key).digest('hex') }, '[IDEMPOTENCY] Replaying cached response');
    return reply.status(cached.statusCode).send(cached.payload);
  }
}

export function getIdempotencyContext(request: FastifyRequest): IdempotencyContext | undefined {
  return (request as FastifyRequest & { idempotencyContext?: IdempotencyContext }).idempotencyContext;
}

export async function saveIdempotencyResponse(request: FastifyRequest, statusCode: number, payload: unknown): Promise<void> {
  const context = getIdempotencyContext(request);
  if (!context || context.replayed || statusCode >= 500) return;
  const serializedPayload = typeof payload === 'string' ? payload : String(payload);
  // Large exports/uploads should not be copied into a resilience cache. Their
  // domain idempotency keys still protect the mutation itself.
  if (Buffer.byteLength(serializedPayload, 'utf8') > MAX_CACHED_PAYLOAD_BYTES) return;
  await activeStore.set(context.cacheKey, {
    statusCode,
    payload: serializedPayload,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}
