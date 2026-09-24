import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createUsersMemoryState } from './users.helpers.js';
import { createUsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';
import usersRoutes from './users.routes.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(usersRoutes, {
    usersService: new UsersService(createUsersRepository(null, createUsersMemoryState())),
    persistAuditLog: async () => undefined,
  });
  return app;
}

test('users routes require teacher role and preserve list/create envelopes', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const memberToken = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'GET', url: '/api/users', headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(denied.statusCode, 403);

  const teacherToken = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${teacherToken}` };
  const created = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers,
    payload: { username: 'route_teacher', name: 'Route Teacher', role: 'teacher', password: 'Strong123' },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().success, true);
  assert.equal(typeof created.json().temporary_password, 'string');
  assert.equal(Object.prototype.hasOwnProperty.call(created.json().data, 'password_hash'), false);

  const invalidStudentRole = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers,
    payload: { username: 'route_leader', name: 'Route Leader', role: 'leader', password: 'Strong123' },
  });
  assert.equal(invalidStudentRole.statusCode, 400);

  const list = await app.inject({ method: 'GET', url: '/api/users?page=1&pageSize=1', headers });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().success, true);
  assert.equal(list.json().pageSize, 1);
  assert.equal(list.json().data.length, 1);
});

test('users routes validate change reasons and reset response', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };
  const created = await app.inject({
    method: 'POST', url: '/api/users', headers,
    payload: { username: 'reset_route', name: 'Reset Route', role: 'treasurer', password: 'Strong123' },
  });
  const id = created.json().data.id;
  const invalid = await app.inject({ method: 'PUT', url: `/api/users/${id}`, headers, payload: { name: 'Nama Baru' } });
  assert.equal(invalid.statusCode, 422);

  const renamed = await app.inject({
    method: 'PUT', url: `/api/users/${id}`,
    headers: { ...headers, 'x-change-reason': 'Menyesuaikan username login pengguna' },
    payload: { username: 'reset.route.updated' },
  });
  assert.equal(renamed.statusCode, 200);
  assert.equal(renamed.json().data.username, 'reset.route.updated');
  assert.equal(renamed.json().data.id, id);

  const reset = await app.inject({
    method: 'POST', url: `/api/users/${id}/reset-password`,
    payload: {},
    headers: {
      ...headers,
      'x-change-reason': 'Reset akun karena lupa password',
      'x-idempotency-key': 'reset-route-key-001',
    },
  });
  assert.equal(reset.statusCode, 200);
  assert.equal(reset.json().success, true);
  assert.equal(typeof reset.json().temporary_password, 'string');
  assert.equal(Object.prototype.hasOwnProperty.call(reset.json(), 'password_hash'), false);

  const replay = await app.inject({
    method: 'POST', url: `/api/users/${id}/reset-password`, payload: {},
    headers: { ...headers, 'x-change-reason': 'Reset akun karena lupa password', 'x-idempotency-key': 'reset-route-key-001' },
  });
  assert.equal(replay.statusCode, 409);
  assert.equal(replay.json().error_code, 'RESET_OPERATION_REPLAY');
});

test('reset password requires an idempotency key', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const response = await app.inject({
    method: 'POST', url: '/api/users/missing/reset-password', payload: {},
    headers: { authorization: `Bearer ${token}`, 'x-change-reason': 'Reset akun karena lupa password' },
  });
  assert.equal(response.statusCode, 400);
});
