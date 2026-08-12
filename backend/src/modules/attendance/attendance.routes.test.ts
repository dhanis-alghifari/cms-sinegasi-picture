import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import attendanceRoutes from './attendance.routes.js';

test('attendance routes keep authenticated list and summary response envelopes', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const attendanceService = {
    repositoryIsConfigured: () => false,
    list: async () => ({ data: [{ id: 'att-1' }], total: 1, page: 1, pageSize: 50, totalPages: 1 }),
    summary: async () => ({ hadir: 1, sakit: 0, izin: 0, alpha: 0, total: 1 }),
    record: async () => ({ id: 'att-1', status: 'hadir' }),
    correct: async () => ({ id: 'att-1', status: 'izin' }),
  } as any;
  await app.register(attendanceRoutes, {
    attendanceService,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const token = app.jwt.sign({
    userId: 'usr-1', username: 'teacher', role: 'teacher', isFirstLogin: false,
  });
  const headers = { authorization: `Bearer ${token}` };
  const list = await app.inject({ method: 'GET', url: '/api/attendance?page=1&pageSize=50', headers });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().success, true);
  assert.equal(list.json().total, 1);

  const summary = await app.inject({ method: 'GET', url: '/api/attendance/summary', headers });
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json().persentaseKehadiran, 100);
});

test('attendance write route rejects incomplete payloads at the HTTP boundary', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(attendanceRoutes, {
    attendanceService: {} as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const token = app.jwt.sign({
    userId: 'usr-1', username: 'teacher', role: 'teacher', isFirstLogin: false,
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/attendance',
    headers: { authorization: `Bearer ${token}` },
    payload: { student_id: 'student-1' },
  });
  assert.equal(response.statusCode, 400);
});
