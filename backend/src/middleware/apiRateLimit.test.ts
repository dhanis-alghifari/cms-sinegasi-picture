import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type preHandlerHookHandler } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  API_RATE_LIMIT_POLICIES,
  ApiRateLimitUnavailableError,
  createApiRateLimitStore,
  createMemoryApiRateLimitStore,
  getApiRateLimitKey,
  getApiRateLimitPolicies,
  type ApiRateLimitPolicy,
  type ApiRateLimitStore,
} from './apiRateLimit.js';
import { registerApiRateLimitHooks } from './apiRateLimit.hooks.js';
import { createSupabaseApiRateLimitStore } from './apiRateLimit.supabase.js';

const smallPolicy: ApiRateLimitPolicy = { name: 'fixture', maxRequests: 2, windowSeconds: 60 };

test('memory quotas admit the exact limit, isolate principals, and reset in the next window', async () => {
  let now = 1_000;
  const store = createMemoryApiRateLimitStore(() => now);
  assert.equal((await store.consume('a', smallPolicy)).allowed, true);
  assert.equal((await store.consume('a', smallPolicy)).remaining, 0);
  const exceeded = await store.consume('a', smallPolicy);
  assert.equal(exceeded.allowed, false);
  assert.equal(exceeded.resetAt, 60_000);
  assert.equal((await store.consume('b', smallPolicy)).allowed, true);
  now = 60_000;
  assert.equal((await store.consume('a', smallPolicy)).remaining, 1);
});

test('memory capacity fails closed without evicting another active principal', async () => {
  let now = 1_000;
  const store = createMemoryApiRateLimitStore(() => now, 1);
  await store.consume('a', smallPolicy);
  await assert.rejects(store.consume('b', smallPolicy), ApiRateLimitUnavailableError);
  await store.consume('a', smallPolicy);
  assert.equal((await store.consume('a', smallPolicy)).allowed, false);
  now = 60_000;
  assert.equal((await store.consume('b', smallPolicy)).allowed, true);
});

test('public deployments never fall back to memory on absent or unavailable shared counters', async () => {
  const missing = createApiRateLimitStore({ shared: null, persistentRequired: true });
  await assert.rejects(missing.consume('key', smallPolicy), ApiRateLimitUnavailableError);
  let calls = 0;
  let now = 1_000;
  const failing: ApiRateLimitStore = { async consume() { calls += 1; throw new Error('dummy outage'); } };
  const store = createApiRateLimitStore({ shared: failing, persistentRequired: true, now: () => now });
  await assert.rejects(store.consume('a', smallPolicy), ApiRateLimitUnavailableError);
  await assert.rejects(store.consume('b', smallPolicy), ApiRateLimitUnavailableError);
  assert.equal(calls, 1);
  now = 6_000;
  await assert.rejects(store.consume('c', smallPolicy), ApiRateLimitUnavailableError);
  assert.equal(calls, 2);
});

test('local-only development supports memory and hot-key prefilter skips shared calls', async () => {
  const local = createApiRateLimitStore({ shared: null, persistentRequired: false });
  assert.equal((await local.consume('a', smallPolicy)).allowed, true);
  const shared = createMemoryApiRateLimitStore(() => 1_000);
  let calls = 0;
  const store = createApiRateLimitStore({
    shared: { async consume(key, policy) { calls += 1; return shared.consume(key, policy); } },
    persistentRequired: true,
    now: () => 1_000,
  });
  await store.consume('a', smallPolicy);
  await store.consume('a', smallPolicy);
  assert.equal((await store.consume('a', smallPolicy)).allowed, false);
  assert.equal(calls, 2);
});

test('two workers share a quota and concurrent requests cannot all pass', async () => {
  const shared = createMemoryApiRateLimitStore(() => 1_000);
  const a = createApiRateLimitStore({ shared, persistentRequired: true, now: () => 1_000 });
  const b = createApiRateLimitStore({ shared, persistentRequired: true, now: () => 1_000 });
  const decisions = await Promise.all([
    a.consume('one-principal', smallPolicy),
    b.consume('one-principal', smallPolicy),
    a.consume('one-principal', smallPolicy),
    b.consume('one-principal', smallPolicy),
  ]);
  assert.equal(decisions.filter((decision) => decision.allowed).length, 2);
});

test('shared-store concurrency is bounded and an occupied slot cannot fail open', async () => {
  let finish: (() => void) | undefined;
  const shared: ApiRateLimitStore = {
    async consume(_key, policy) {
      await new Promise<void>((resolve) => { finish = resolve; });
      return { allowed: true, limit: policy.maxRequests, remaining: 1, resetAt: 60_000 };
    },
  };
  const store = createApiRateLimitStore({ shared, persistentRequired: true, now: () => 1_000, maxPendingOperations: 1 });
  const occupied = store.consume('a', smallPolicy);
  // Let the first consume cross its asynchronous memory prefilter into shared.
  await Promise.resolve();
  await assert.rejects(store.consume('b', smallPolicy), ApiRateLimitUnavailableError);
  assert.ok(finish);
  finish();
  assert.equal((await occupied).allowed, true);
});

test('Supabase adapter requests the atomic RPC, applies a timeout, and validates the response', async () => {
  let capturedName: string | undefined;
  let capturedParams: Record<string, unknown> | undefined;
  let signal: AbortSignal | undefined;
  const client = {
    rpc(name: string, params: Record<string, unknown>) {
      capturedName = name;
      capturedParams = params;
      return { async abortSignal(receivedSignal: AbortSignal) {
        signal = receivedSignal;
        return { data: { allowed: true, limit: 2, remaining: 1, reset_at: '1970-01-01T00:01:00Z' }, error: null };
      } };
    },
  } as unknown as SupabaseClient;
  const key = getApiRateLimitKey('dummy-principal', smallPolicy);
  const decision = await createSupabaseApiRateLimitStore(client).consume(key, smallPolicy);
  assert.equal(capturedName, 'consume_api_rate_limit_atomic');
  assert.deepEqual(capturedParams, { p_rate_key: key, p_window_seconds: 60, p_max_requests: 2 });
  assert.ok(signal instanceof AbortSignal);
  assert.equal(decision.resetAt, 60_000);
});

test('Supabase adapter rejects errors or malformed results rather than treating them as an allowed request', async () => {
  for (const data of [null, [], { allowed: true, limit: 2, remaining: 10, reset_at: 'invalid' }]) {
    const client = {
      rpc() { return { async abortSignal() { return { data, error: null }; } }; },
    } as unknown as SupabaseClient;
    await assert.rejects(createSupabaseApiRateLimitStore(client).consume('dummy-key', smallPolicy), ApiRateLimitUnavailableError);
  }
});

test('quota identity cannot be reset by token renewal and raw principal data is not persisted', () => {
  const a = getApiRateLimitKey('account:dummy-user-a', smallPolicy);
  const b = getApiRateLimitKey('account:dummy-user-b', smallPolicy);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  assert.equal(a.includes('dummy-user'), false);
  assert.notEqual(a, getApiRateLimitKey('account:dummy-user-a', { ...smallPolicy, name: 'other-operation' }));
});

test('sensitive operation policies cover uploads, credentials, exports, PII reads, and writes', () => {
  const names = (method: string, route: string) => getApiRateLimitPolicies(method, route).map((policy) => policy.name);
  assert.deepEqual(names('POST', '/api/agenda/:id/photo-uploads'), ['account', 'write', 'upload']);
  assert.ok(names('POST', '/api/borrowing/:id/return-evidence-uploads').includes('upload'));
  assert.ok(names('POST', '/api/cash/disputes').includes('upload'));
  assert.ok(names('POST', '/api/users/:id/reset-password').includes('credentials'));
  assert.ok(names('PUT', '/api/users/:id').includes('credentials'));
  assert.ok(names('POST', '/api/students/:id/link-account').includes('credentials'));
  assert.ok(names('POST', '/api/students/:id/account-links').includes('credentials'));
  assert.ok(names('POST', '/api/students/account-links').includes('credentials'));
  assert.ok(names('DELETE', '/api/students/:id').includes('credentials'));
  assert.ok(names('PUT', '/api/access-control/roles/:role/capabilities').includes('credentials'));
  assert.ok(names('GET', '/api/students').includes('sensitive-read'));
  assert.ok(names('GET', '/api/cash/report').includes('report'));
});

test('verified account quotas run before permissions/replay; changing query strings does not bypass', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  const calls: string[] = [];
  const authenticate: preHandlerHookHandler = async (request, reply) => {
    calls.push('authenticate');
    if (request.headers.authorization === 'Bearer invalid-fixture') {
      reply.status(401).send({ success: false });
      return;
    }
    request.user = { userId: 'verified-fixture' } as typeof request.user;
  };
  const underlying = createMemoryApiRateLimitStore(() => 1_000);
  const store: ApiRateLimitStore = {
    async consume(key, policy) {
      calls.push(policy.name);
      const effectivePolicy = policy.name === 'account' ? { ...policy, maxRequests: 1 } : policy;
      return underlying.consume(key, effectivePolicy);
    },
  };
  registerApiRateLimitHooks(app, { authenticate, store, now: () => 1_000 });
  app.get('/api/students', {
    preHandler: [authenticate, async () => { calls.push('permissions'); }, async () => { calls.push('replay'); }],
  }, async () => ({ success: true }));
  assert.equal((await app.inject({ url: '/api/students?page=1' })).statusCode, 200);
  assert.deepEqual(calls, ['ip', 'authenticate', 'account', 'sensitive-read', 'permissions', 'replay']);
  calls.length = 0;
  const denied = await app.inject({ url: '/api/students?page=999&random=fixture' });
  assert.equal(denied.statusCode, 429);
  assert.equal(denied.headers['retry-after'], '59');
  assert.equal(denied.headers['x-ratelimit-remaining'], '0');
  assert.deepEqual(calls, ['ip', 'authenticate', 'account']);
  calls.length = 0;
  assert.equal((await app.inject({ url: '/api/students', headers: { authorization: 'Bearer invalid-fixture' } })).statusCode, 401);
  assert.deepEqual(calls, ['ip', 'authenticate']);
});

test('IP quotas reject before authentication, while OPTIONS and health checks are exempt', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  let authenticateCalls = 0;
  let storeCalls = 0;
  const authenticate: preHandlerHookHandler = async () => { authenticateCalls += 1; };
  registerApiRateLimitHooks(app, {
    authenticate,
    store: { async consume(_key, policy) {
      storeCalls += 1;
      return { allowed: false, limit: policy.maxRequests, remaining: 0, resetAt: 60_000 };
    } },
    now: () => 1_000,
  });
  app.get('/api/students', { preHandler: authenticate }, async () => ({ success: true }));
  app.get('/api/health', async () => ({ status: 'ok' }));
  app.options('/api/students', async () => ({}));
  assert.equal((await app.inject({ url: '/api/students' })).statusCode, 429);
  assert.equal(authenticateCalls, 0);
  assert.equal((await app.inject({ url: '/api/health' })).statusCode, 200);
  assert.equal((await app.inject({ method: 'OPTIONS', url: '/api/students' })).statusCode, 200);
  assert.equal(storeCalls, 1);
});

test('store failure returns a generic retryable 503 without provider details', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  registerApiRateLimitHooks(app, {
    authenticate: async () => undefined,
    store: { async consume() { throw new Error('dummy private provider error'); } },
  });
  app.get('/api/example', async () => ({ success: true }));
  const response = await app.inject('/api/example');
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '5');
  assert.equal(response.body.includes('provider'), false);
  assert.equal(response.json().error_code, 'RATE_LIMIT_UNAVAILABLE');
});

test('the school IP ceiling is generous compared with one account ceiling', () => {
  assert.ok(API_RATE_LIMIT_POLICIES.ip.maxRequests > API_RATE_LIMIT_POLICIES.account.maxRequests);
});
