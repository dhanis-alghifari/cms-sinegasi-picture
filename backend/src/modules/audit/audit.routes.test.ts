import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import auditRoutes from './audit.routes.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const auditService = {
    list: async () => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
    getEntry: async () => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', action: 'UPDATE', table_name: 'students', changed_fields: [], actor: {} }),
    listRecordHistory: async () => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
  } as any;
  await app.register(auditRoutes, { auditService });
  return app;
}

test('audit routes keep teacher authorization and response envelopes', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const unauthenticated = await app.inject({ method: 'GET', url: '/api/audit-logs' });
  assert.equal(unauthenticated.statusCode, 401);

  const memberToken = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'GET', url: '/api/audit-logs', headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(denied.statusCode, 403);

  const teacherToken = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${teacherToken}` };
  const list = await app.inject({ method: 'GET', url: '/api/audit-logs?page=1&pageSize=20', headers });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().success, true);
  assert.equal(list.json().totalPages, 1);

  const entry = await app.inject({ method: 'GET', url: '/api/audit-logs/entry/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', headers });
  assert.equal(entry.statusCode, 200);
  assert.equal(entry.json().data.table_name, 'students');

  const history = await app.inject({ method: 'GET', url: '/api/audit-logs/students/record-1', headers });
  assert.equal(history.statusCode, 200);
});

test('audit route schema rejects malformed entry and history identifiers', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };

  const entry = await app.inject({ method: 'GET', url: '/api/audit-logs/entry/not-a-uuid', headers });
  assert.equal(entry.statusCode, 400);
  const history = await app.inject({ method: 'GET', url: '/api/audit-logs/students%3Bdrop/record-1', headers });
  assert.equal(history.statusCode, 400);
});
