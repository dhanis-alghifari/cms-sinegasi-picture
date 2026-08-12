import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import cashDisputesRoutes from './cash.disputes.routes.js';

test('cash dispute routes enforce ownership and manager resolution', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let created = false;
  await app.register(cashDisputesRoutes, {
    disputesService: {
      repositoryIsConfigured: () => false,
      create: async () => { created = true; return { id: 'dispute-1', transaction_id: 'tx-1', student_id: 'student-1', status: 'pending' }; },
      resolve: async () => ({ id: 'dispute-1', status: 'approved' }),
    } as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());
  const treasurer = app.jwt.sign({ userId: 'usr-1', username: 'treasurer', role: 'treasurer', isFirstLogin: false });
  const teacher = app.jwt.sign({ userId: 'usr-2', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const create = await app.inject({ method: 'POST', url: '/api/cash/disputes', headers: { authorization: `Bearer ${treasurer}` }, payload: { transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan', bukti_sanggahan_url: 'https://example.test/proof.jpg' } });
  assert.equal(create.statusCode, 201);
  assert.equal(created, true);
  const resolve = await app.inject({ method: 'PATCH', url: '/api/cash/disputes/dispute-1', headers: { authorization: `Bearer ${teacher}` }, payload: { status: 'resolved' } });
  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.json().data.status, 'approved');
});
