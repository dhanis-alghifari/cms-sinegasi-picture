import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { runtimeConfig } from '../config/env.js';
import { authenticate } from './authMiddleware.js';

test('a public API cannot authenticate mock identities even with a correctly signed token', async (t) => {
  const original = runtimeConfig.publicDeployment;
  runtimeConfig.publicDeployment = true;
  const app = Fastify();
  await app.register(jwt, { secret: 'isolated-fixture-secret-only-for-test' });
  app.get('/api/private', { preHandler: [authenticate] }, async () => ({ secret: 'must-not-be-returned' }));
  t.after(async () => { runtimeConfig.publicDeployment = original; await app.close(); });
  const token = app.jwt.sign({ userId: 'usr-01', username: 'guru_pembina', role: 'teacher', isFirstLogin: false });
  const response = await app.inject({ method: 'GET', url: '/api/private', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error_code, 'INVALID_SESSION');
  assert.equal(response.json().secret, undefined);
});
