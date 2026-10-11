import assert from 'node:assert/strict';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import authRoutes from '../modules/auth/auth.routes.js';
import type { AuthLoginResult } from '../modules/auth/auth.service.js';
import { AuthServiceError } from '../modules/auth/auth.service.js';
import type { LoginRateLimiter } from '../modules/auth/loginRateLimiter.js';
import {
  configureIdempotencyStore,
  createMemoryIdempotencyStore,
  createSupabaseIdempotencyStore,
  type IdempotencyStore,
  registerAuthorizedIdempotencyHook,
  saveIdempotencyResponse,
} from './idempotencyMiddleware.js';

function cacheableRequest(disableIdempotencyCache = false): FastifyRequest {
  return {
    routeOptions: { config: { disableIdempotencyCache } },
    idempotencyContext: { key: 'request-key-001', cacheKey: 'cache-key-001', replayed: false },
  } as unknown as FastifyRequest;
}

test('credential response fields are never persisted, including nested arrays and alternate casing', async (t) => {
  let cachedResponses = 0;
  const store: IdempotencyStore = {
    get: () => null,
    set: () => { cachedResponses += 1; },
  };
  configureIdempotencyStore(store);
  t.after(() => configureIdempotencyStore(createMemoryIdempotencyStore()));

  for (const key of [
    'temporary_password', 'password', 'passwordHash', 'access_token', 'refreshToken',
    'id-token', 'Token', 'authorization', 'client_secret', 'session_secret',
    'sessionToken', 'csrf_token', 'api_key', 'privateKey', 'set-cookie',
    'upload_url', 'accessUrl', 'signed-url',
  ]) {
    const payload = { success: true, data: [{ account: { [key]: 'dummy-secret' } }] };
    await saveIdempotencyResponse(cacheableRequest(), 201, JSON.stringify(payload));
    await saveIdempotencyResponse(cacheableRequest(), 201, payload);
    await saveIdempotencyResponse(cacheableRequest(), 201, Buffer.from(JSON.stringify(payload)));
  }
  assert.equal(cachedResponses, 0);
});

test('deeply nested credential JSON cannot bypass the cache guard through recursion limits', async (t) => {
  let cachedResponses = 0;
  configureIdempotencyStore({ get: () => null, set: () => { cachedResponses += 1; } });
  t.after(() => configureIdempotencyStore(createMemoryIdempotencyStore()));
  const payload = `${'['.repeat(10_000)}{"temporary_password":"dummy-secret"}${']'.repeat(10_000)}`;
  await saveIdempotencyResponse(cacheableRequest(), 200, payload);
  assert.equal(cachedResponses, 0);
});

test('non-secret response prose remains cacheable and objects preserve their JSON representation', async (t) => {
  const store = createMemoryIdempotencyStore();
  configureIdempotencyStore(store);
  t.after(() => configureIdempotencyStore(createMemoryIdempotencyStore()));
  const payload = {
    message: 'A password reset guide mentions tokens, but contains no credentials.',
    token_count: 4,
    password_required: true,
    data: [{ id: 'record-1', status: 'completed' }],
  };
  await saveIdempotencyResponse(cacheableRequest(), 201, payload);
  assert.deepEqual(JSON.parse((await store.get('cache-key-001'))!.payload), payload);
});

test('response save respects explicit opt-outs and skips circular or missing values', async (t) => {
  let cachedResponses = 0;
  configureIdempotencyStore({ get: () => null, set: () => { cachedResponses += 1; } });
  t.after(() => configureIdempotencyStore(createMemoryIdempotencyStore()));
  await saveIdempotencyResponse(cacheableRequest(true), 201, '{"ok":true}');
  const circular: { self?: unknown } = {};
  circular.self = circular;
  await saveIdempotencyResponse(cacheableRequest(), 201, circular);
  await saveIdempotencyResponse(cacheableRequest(), 201, undefined);
  assert.equal(cachedResponses, 0);
});

test('legacy cached credential responses are refused without replay or re-executing the mutation', async (t) => {
  const app = Fastify();
  let writes = 0;
  let cacheWrites = 0;
  let cachedPayload = '';
  configureIdempotencyStore({
    get: () => ({
      statusCode: 201,
      payload: cachedPayload,
      expiresAt: Date.now() + 1_000,
    }),
    set: () => { cacheWrites += 1; },
  });
  t.after(async () => {
    configureIdempotencyStore(createMemoryIdempotencyStore());
    await app.close();
  });
  const authenticate = async (request: FastifyRequest): Promise<void> => {
    request.user = { userId: 'actor-1', username: 'actor', role: 'teacher', isFirstLogin: false };
  };
  registerAuthorizedIdempotencyHook(app, authenticate);
  app.addHook('onSend', async (request, reply, payload) => {
    await saveIdempotencyResponse(request, reply.statusCode, payload);
    return payload;
  });
  app.post('/records', { preHandler: [authenticate] }, async () => ({ write: ++writes }));

  for (const key of ['temporary_password', 'upload_url', 'accessUrl', 'signed-url']) {
    cachedPayload = JSON.stringify({ account: { [key]: 'dummy-legacy-secret' } });
    const response = await app.inject({ method: 'POST', url: '/records', headers: { 'x-idempotency-key': 'legacy-key-001' }, payload: {} });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error_code, 'IDEMPOTENCY_RESPONSE_NOT_REPLAYABLE');
    assert.equal(response.body.includes('dummy-legacy-secret'), false);
  }
  assert.equal(writes, 0);
  assert.equal(cacheWrites, 0);
});

test('memory idempotency store expires and replaces responses by cache key', async () => {
  const store = createMemoryIdempotencyStore();
  const now = Date.now();
  store.set('same-request', { statusCode: 201, payload: '{"ok":true}', expiresAt: now + 1_000 });
  assert.equal((await store.get('same-request', now + 500))?.statusCode, 201);
  assert.equal(await store.get('same-request', now + 1_000), null);
});

test('Supabase idempotency adapter falls back cleanly when no client is configured', async () => {
  const fallback = createMemoryIdempotencyStore();
  const store = createSupabaseIdempotencyStore(null, fallback);
  store.set('fallback-request', { statusCode: 200, payload: 'ok', expiresAt: Date.now() + 1_000 });
  assert.equal((await store.get('fallback-request'))?.payload, 'ok');
});

test('idempotency replay runs after authentication and authorization and scopes the full request', async (t) => {
  const app = Fastify();
  configureIdempotencyStore(createMemoryIdempotencyStore());
  t.after(async () => {
    configureIdempotencyStore(createMemoryIdempotencyStore());
    await app.close();
  });

  let authenticated = true;
  let authorized = true;
  let writes = 0;
  const authenticate = async (request: { headers: Record<string, string | string[] | undefined>; user?: unknown }, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) => {
    if (!authenticated) return reply.status(401).send({ success: false });
    const userId = request.headers.authorization === 'Bearer user-b' ? 'user-b' : 'user-a';
    request.user = { userId, authVersion: 3 };
  };
  const authorize = async (_request: unknown, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) => {
    if (!authorized) return reply.status(403).send({ success: false });
  };

  registerAuthorizedIdempotencyHook(app, authenticate);
  app.addHook('onSend', async (request, reply, payload) => {
    await saveIdempotencyResponse(request, reply.statusCode, payload);
    return payload;
  });
  app.post<{ Params: { id: string }; Body: { value: string } }>('/records/:id', {
    preHandler: [authenticate, authorize],
  }, async (request) => ({ id: request.params.id, value: request.body.value, write: ++writes }));

  const send = (id: string, value: string, authorization = 'Bearer user-a', key = 'request-key-001') => app.inject({
    method: 'POST',
    url: `/records/${id}?view=full`,
    headers: { authorization, 'x-idempotency-key': key },
    payload: { value },
  });

  const first = await send('record-a', 'first');
  const retry = await send('record-a', 'first');
  assert.equal(first.statusCode, 200);
  assert.equal(retry.json().write, 1);
  assert.equal(writes, 1);

  assert.equal((await send('record-a', 'changed')).json().write, 2);
  assert.equal((await send('record-b', 'first')).json().write, 3);
  assert.equal((await send('record-a', 'first', 'Bearer user-b')).json().write, 4);
  assert.equal((await send('record-a', 'first', 'Bearer user-a', 'request-key-002')).json().write, 5);

  authenticated = false;
  assert.equal((await send('record-a', 'first')).statusCode, 401);
  assert.equal(writes, 5);

  authenticated = true;
  authorized = false;
  assert.equal((await send('record-a', 'first')).statusCode, 403);
  assert.equal(writes, 5);
});

test('login responses are not replayed by the authorized idempotency cache', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  configureIdempotencyStore(createMemoryIdempotencyStore());
  t.after(async () => {
    configureIdempotencyStore(createMemoryIdempotencyStore());
    await app.close();
  });

  registerAuthorizedIdempotencyHook(app, async () => undefined);
  app.addHook('onSend', async (request, reply, payload) => {
    await saveIdempotencyResponse(request, reply.statusCode, payload);
    return payload;
  });

  let loginCalls = 0;
  const result: AuthLoginResult = {
    payload: {
      userId: '11111111-1111-4111-8111-111111111111',
      username: 'teacher',
      role: 'teacher',
      isFirstLogin: false,
    },
    user: { id: '11111111-1111-4111-8111-111111111111', username: 'teacher' },
  };
  const authService = {
    login: async (_username: string, password: string) => {
      loginCalls += 1;
      if (password !== 'Password123') throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
      return result;
    },
    getSession: async () => ({}),
    changePassword: async () => { throw new Error('not used'); },
  } as any;
  const rateLimiter: LoginRateLimiter = {
    isLimited: () => false,
    recordFailure: () => undefined,
    clear: () => undefined,
  };
  await app.register(authRoutes, { authService, loginRateLimiter: rateLimiter });

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-idempotency-key': 'login-key-001' },
    payload: { username: 'teacher', password: 'Password123' },
  });
  const replayAttempt = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-idempotency-key': 'login-key-001' },
    payload: { username: 'teacher', password: 'Password123' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(replayAttempt.statusCode, 200);
  assert.equal(loginCalls, 2);
});
