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
      listReturnEvidence: async () => [{ evidence_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', access_url: 'https://download.example.test/signed', expires_in_seconds: 900 }],
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

  const evidence = await app.inject({
    method: 'GET', url: '/api/borrowing/bor-1/return-evidence',
    headers: { authorization: `Bearer ${teacher}` },
  });
  assert.equal(evidence.statusCode, 200);
  assert.equal(evidence.json().data[0].access_url, 'https://download.example.test/signed');
});

test('leader can submit only for the linked student and cannot approve', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let receivedStudentId: string | undefined;
  await app.register(borrowingMutationsRoutes, {
    borrowingMutationsService: {
      repositoryIsConfigured: () => false,
      create: async (_input: unknown, _actor: unknown, actorStudentId: string | null) => {
        receivedStudentId = actorStudentId ?? undefined;
        return { id: 'bor-1', status: 'menunggu_persetujuan' };
      },
    } as any,
  });
  t.after(() => app.close());

  const leader = app.jwt.sign({
    userId: 'leader-1', username: 'leader', role: 'leader', studentId: 'student-1', isFirstLogin: false,
  });
  const headers = { authorization: `Bearer ${leader}` };
  const created = await app.inject({
    method: 'POST',
    url: '/api/borrowing',
    headers,
    payload: {
      borrower_id: 'student-1',
      equipment_ids: ['equipment-1'],
      borrow_date: '2026-09-19',
      planned_return_date: '2026-09-21',
      purpose: 'Produksi tugas film',
    },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(receivedStudentId, 'student-1');

  const approval = await app.inject({
    method: 'POST',
    url: '/api/borrowing/bor-1/approve-reject',
    headers: { ...headers, 'x-change-reason': 'Tidak boleh' },
    payload: { action: 'approve' },
  });
  assert.equal(approval.statusCode, 403);
});
