import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import authRoutes from './auth.routes.js';
import type { AuthLoginResult } from './auth.service.js';
import { AuthServiceError } from './auth.service.js';
import type { LoginRateLimiter } from './loginRateLimiter.js';

const limiter: LoginRateLimiter = {
  isLimited: () => false,
  recordFailure: () => undefined,
  clear: () => undefined,
};

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
  } as any;
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
  } as any;
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
