import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test, { type TestContext } from 'node:test';
import authRoutes from './auth.routes.js';
import type { AuthLoginResult, AuthService } from './auth.service.js';
import { AuthServiceError } from './auth.service.js';
import { createLoginRateLimiter, getLoginRateLimitKeys, type LoginRateLimiter } from './loginRateLimiter.js';

const limiter: LoginRateLimiter = {
  isLimited: () => false,
  recordFailure: () => undefined,
  clear: () => undefined,
};

const loginResult: AuthLoginResult = {
  payload: {
    userId: '11111111-1111-4111-8111-111111111111',
    username: 'fixtureuser',
    role: 'teacher',
    isFirstLogin: false,
  },
  user: { id: '11111111-1111-4111-8111-111111111111', username: 'fixtureuser' },
};

async function createApp(t: TestContext, login: AuthService['login'], loginRateLimiter: LoginRateLimiter = limiter) {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const service = {
    login,
    getSession: async () => ({}),
    changePassword: async () => { throw new Error('not used'); },
  } as unknown as AuthService;
  await app.register(authRoutes, { authService: service, loginRateLimiter });
  t.after(() => app.close());
  return app;
}

test('auth login route validates input and returns a signed token', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const result: AuthLoginResult = {
    payload: {
      userId: '11111111-1111-4111-8111-111111111111',
      username: 'admin',
      role: 'teacher',
      isFirstLogin: false,
    },
    user: { id: '11111111-1111-4111-8111-111111111111', username: 'admin' },
  };
  const service = {
    login: async () => result,
    getSession: async () => ({}),
    changePassword: async () => { throw new Error('not used'); },
  } as unknown as AuthService;
  await app.register(authRoutes, { authService: service, loginRateLimiter: limiter });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'Password123' },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.equal(typeof response.json().token, 'string');
});

test('auth login route exposes a stable invalid-credentials response', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const service = {
    login: async () => { throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.'); },
    getSession: async () => ({}),
    changePassword: async () => { throw new Error('not used'); },
  } as unknown as AuthService;
  await app.register(authRoutes, { authService: service, loginRateLimiter: limiter });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'wrong' },
  });
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    success: false,
    error: 'Invalid credentials',
    message: 'Username atau password salah.',
  });
});

test('login records and clears both account-global and IP-scoped keys', async (t) => {
  const checked: string[] = [];
  const failed: string[] = [];
  const cleared: string[] = [];
  let shouldFail = true;
  const app = await createApp(t, async () => {
    if (shouldFail) throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
    return loginResult;
  }, {
    isLimited(key) { checked.push(key); return false; },
    recordFailure(key) { failed.push(key); },
    clear(key) { cleared.push(key); },
  });
  const request = {
    method: 'POST' as const,
    url: '/api/auth/login',
    remoteAddress: '192.0.2.10',
    payload: { username: ' FixtureUser ', password: 'fixture-password' },
  };
  assert.equal((await app.inject(request)).statusCode, 401);
  const keys = getLoginRateLimitKeys('192.0.2.10', 'fixtureuser');
  assert.deepEqual(checked, keys);
  assert.deepEqual(failed, keys);
  shouldFail = false;
  assert.equal((await app.inject(request)).statusCode, 200);
  assert.deepEqual(cleared, keys);
});

test('changing IP and username casing does not reset account failure count', async (t) => {
  let serviceCalls = 0;
  const app = await createApp(t, async () => {
    serviceCalls += 1;
    throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
  }, createLoginRateLimiter(300_000, 2, 100));
  const request = { method: 'POST' as const, url: '/api/auth/login' };
  assert.equal((await app.inject({
    ...request, remoteAddress: '192.0.2.10', payload: { username: 'FixtureUser', password: 'wrong-fixture' },
  })).statusCode, 401);
  assert.equal((await app.inject({
    ...request, remoteAddress: '192.0.2.11', payload: { username: ' fixtureuser ', password: 'wrong-fixture' },
  })).statusCode, 401);
  const blocked = await app.inject({
    ...request, remoteAddress: '192.0.2.12', payload: { username: 'FIXTUREUSER', password: 'wrong-fixture' },
  });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['retry-after'], '300');
  assert.equal(serviceCalls, 2);
});

test('unavailable limiter returns generic 503 with Retry-After before authenticating', async (t) => {
  let serviceCalls = 0;
  const app = await createApp(t, async () => { serviceCalls += 1; return loginResult; }, {
    ...limiter,
    isLimited() { throw new Error('private-fixture-store-detail'); },
  });
  const response = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { username: 'fixtureuser', password: 'fixture-password' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '5');
  assert.deepEqual(response.json(), {
    success: false,
    error: 'AUTHENTICATION_UNAVAILABLE',
    message: 'Layanan login sementara tidak tersedia. Coba lagi sebentar.',
  });
  assert.equal(response.body.includes('private-fixture-store-detail'), false);
  assert.equal(serviceCalls, 0);
});

test('malformed limiter decision cannot silently permit login', async (t) => {
  let serviceCalls = 0;
  const app = await createApp(t, async () => { serviceCalls += 1; return loginResult; }, {
    ...limiter,
    isLimited: () => 'false' as unknown as boolean,
  });
  const response = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { username: 'fixtureuser', password: 'fixture-password' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '5');
  assert.equal(serviceCalls, 0);
});

test('failure-recording outage also fails closed with generic 503', async (t) => {
  const app = await createApp(t, async () => {
    throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
  }, {
    ...limiter,
    recordFailure() { throw new Error('private-fixture-record-detail'); },
  });
  const response = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { username: 'fixtureuser', password: 'wrong-fixture' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '5');
  assert.equal(response.body.includes('private-fixture-record-detail'), false);
  assert.equal('token' in response.json(), false);
});

test('clear-counter outage does not issue a token even after valid credentials', async (t) => {
  const app = await createApp(t, async () => loginResult, {
    ...limiter,
    clear() { throw new Error('private-fixture-clear-detail'); },
  });
  const response = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { username: 'fixtureuser', password: 'fixture-password' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '5');
  assert.equal(response.body.includes('private-fixture-clear-detail'), false);
  assert.equal('token' in response.json(), false);
});

test('oversized usernames are rejected before limiter or authentication work', async (t) => {
  let serviceCalls = 0;
  let limiterCalls = 0;
  const app = await createApp(t, async () => { serviceCalls += 1; return loginResult; }, {
    ...limiter,
    isLimited() { limiterCalls += 1; return false; },
  });
  const response = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { username: 'x'.repeat(65), password: 'fixture-password' },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(serviceCalls, 0);
  assert.equal(limiterCalls, 0);
});
