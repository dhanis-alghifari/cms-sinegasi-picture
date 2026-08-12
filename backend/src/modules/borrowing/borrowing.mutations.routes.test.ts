import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import borrowingMutationsRoutes from './borrowing.mutations.routes.js';

test('borrowing mutation routes preserve the response envelope and pass authenticated requests to the service', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(borrowingMutationsRoutes, {
    borrowingMutationsService: {
      repositoryIsConfigured: () => false,
      create: async () => ({ id: 'bor-1', status: 'menunggu_persetujuan' }),
      approveReject: async () => ({ id: 'bor-1', status: 'disetujui' }),
      handover: async () => ({ id: 'bor-1', status: 'dipinjam' }),
      returnBorrowing: async () => ({ id: 'bor-1', status: 'dikembalikan' }),
    } as any,
  });
  t.after(() => app.close());
  const teacher = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const accepted = await app.inject({
    method: 'POST', url: '/api/borrowing/bor-1/approve-reject',
    headers: { authorization: `Bearer ${teacher}`, 'x-change-reason': 'Alat tersedia' },
    payload: { action: 'approve' },
  });
  assert.equal(accepted.statusCode, 200);
  assert.deepEqual(accepted.json(), { success: true, data: { id: 'bor-1', status: 'disetujui' } });
});
