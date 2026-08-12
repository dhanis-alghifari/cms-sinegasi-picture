import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import overdueRoutes from './overdue.routes.js';

test('manual overdue check keeps teacher authorization and response envelope', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(overdueRoutes, {
    overdueService: {
      runManualCheck: async () => ({
        result: { checkedCount: 2, overdueCount: 1, notifiedCount: 2 },
        logs: [],
      }),
    } as any,
  });
  t.after(() => app.close());

  const memberToken = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({
    method: 'POST',
    url: '/api/admin/overdue-check',
    headers: { authorization: `Bearer ${memberToken}` },
  });
  assert.equal(denied.statusCode, 403);

  const teacherToken = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/overdue-check',
    headers: { authorization: `Bearer ${teacherToken}` },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.equal(response.json().result.overdueCount, 1);
});
