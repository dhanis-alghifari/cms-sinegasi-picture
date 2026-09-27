import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import accessControlRoutes from './access-control.routes.js';

test('access-control routes expose matrix only to authorized teachers', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let updated = false;
  await app.register(accessControlRoutes, {
    accessControlService: {
      getMatrix: async () => ({ roles: [], permissions: [] }),
      updateRoleCapabilities: async () => { updated = true; return { role: 'member', previous: [], capabilities: ['dashboard.read.own'] }; },
    } as any,
  });
  t.after(() => app.close());

  const member = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'GET', url: '/api/access-control/matrix', headers: { authorization: `Bearer ${member}` } });
  assert.equal(denied.statusCode, 403);

  const teacher = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const matrix = await app.inject({ method: 'GET', url: '/api/access-control/matrix', headers: { authorization: `Bearer ${teacher}` } });
  assert.equal(matrix.statusCode, 200);
  assert.equal(matrix.json().success, true);

  const invalidUpdate = await app.inject({
    method: 'PUT',
    url: '/api/access-control/roles/member/capabilities',
    headers: { authorization: `Bearer ${teacher}` },
    payload: { capabilities: ['dashboard.read.own'], change_reason: '' },
  });
  assert.equal(invalidUpdate.statusCode, 400);
  assert.equal(updated, false);

  const update = await app.inject({
    method: 'PUT',
    url: '/api/access-control/roles/member/capabilities',
    headers: { authorization: `Bearer ${teacher}` },
    payload: { capabilities: ['dashboard.read.own'], change_reason: 'Penyesuaian akses semester' },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(updated, true);
});
