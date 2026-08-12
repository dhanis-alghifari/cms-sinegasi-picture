import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import borrowingReadRoutes from './borrowing.read.routes.js';

test('borrowing read routes keep operational role scope and summary envelope', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let receivedScope: { studentId: string | null } | undefined;
  await app.register(borrowingReadRoutes, {
    borrowingReadService: {
      repositoryIsConfigured: () => false,
      list: async (_query: unknown, scope: { studentId: string | null }) => { receivedScope = scope; return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }; },
      summary: async () => ({ totalActive: 0, pendingApproval: 0, overdueCount: 0, returnedToday: 0 }),
    } as any,
  });
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'usr-1', username: 'equipment', role: 'equipment_team', isFirstLogin: false });
  const response = await app.inject({ method: 'GET', url: '/api/borrowing?page=1&pageSize=20', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedScope, { studentId: null });
  const summary = await app.inject({ method: 'GET', url: '/api/borrowing/summary', headers: { authorization: `Bearer ${token}` } });
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json().totalActive, 0);
});
