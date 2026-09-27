import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import cashDisputesRoutes from './cash.disputes.routes.js';

test('cash dispute routes enforce ownership and manager resolution', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const proofUrl = `data:image/jpeg;base64,${'A'.repeat(3_000)}`;
  let created = false;
  let listCalls = 0;
  let lastListStudentId: string | null | undefined;
  let evidenceCalls = 0;
  await app.register(cashDisputesRoutes, {
    disputesService: {
      repositoryIsConfigured: () => false,
      create: async () => { created = true; return { dispute: { id: 'dispute-1', transaction_id: 'tx-1', student_id: 'student-1', status: 'pending' }, quota: { period: '2026-08', period_start: '2026-08-01', limit: 2, used: 1, remaining: 1, resets_at: '2026-09-01T00:00:00.000Z' }, idempotentReplay: false }; },
      list: async (_query: unknown, studentId: string | null) => { listCalls += 1; lastListStudentId = studentId; return { data: [], total: 0, nextCursor: null, hasMore: false }; },
      resolve: async () => ({ dispute: { id: 'dispute-1', status: 'approved', review_note: 'Bukti telah diverifikasi' } }),
      getQuota: async () => ({ period: '2026-08', period_start: '2026-08-01', limit: 2, used: 1, remaining: 1, resets_at: '2026-09-01T00:00:00.000Z' }),
      getEvidence: async () => { evidenceCalls += 1; return { url: 'data:image/jpeg;base64,proof' }; },
    } as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());
  const treasurer = app.jwt.sign({ userId: 'usr-1', username: 'treasurer', role: 'treasurer', studentId: 'student-1', isFirstLogin: false });
  const teacher = app.jwt.sign({ userId: 'usr-2', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const teacherCreate = await app.inject({ method: 'POST', url: '/api/cash/disputes', headers: { authorization: `Bearer ${teacher}`, 'x-idempotency-key': 'teacher-key-001' }, payload: { transaction_id: 'tx-1', reason: 'Tidak boleh mengajukan sebagai guru', evidence_url: proofUrl } });
  assert.equal(teacherCreate.statusCode, 403);
  const create = await app.inject({ method: 'POST', url: '/api/cash/disputes', headers: { authorization: `Bearer ${treasurer}`, 'x-idempotency-key': 'route-key-001' }, payload: { transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan', evidence_url: proofUrl } });
  assert.equal(create.statusCode, 201);
  assert.equal(created, true);
  const treasurerGlobalList = await app.inject({ method: 'GET', url: '/api/cash/disputes?scope=manage', headers: { authorization: `Bearer ${treasurer}` } });
  assert.equal(treasurerGlobalList.statusCode, 403);
  assert.equal(listCalls, 0);
  const treasurerOwnList = await app.inject({ method: 'GET', url: '/api/cash/disputes?scope=own', headers: { authorization: `Bearer ${treasurer}` } });
  assert.equal(treasurerOwnList.statusCode, 200);
  assert.equal(lastListStudentId, 'student-1');
  const treasurerGlobalEvidence = await app.inject({ method: 'GET', url: '/api/cash/disputes/dispute-1/evidence?scope=manage', headers: { authorization: `Bearer ${treasurer}` } });
  assert.equal(treasurerGlobalEvidence.statusCode, 403);
  assert.equal(evidenceCalls, 0);
  const teacherGlobalList = await app.inject({ method: 'GET', url: '/api/cash/disputes?scope=manage', headers: { authorization: `Bearer ${teacher}` } });
  assert.equal(teacherGlobalList.statusCode, 200);
  assert.equal(lastListStudentId, null);
  const treasurerResolve = await app.inject({ method: 'PATCH', url: '/api/cash/disputes/dispute-1', headers: { authorization: `Bearer ${treasurer}` }, payload: { status: 'rejected', review_note: 'Bendahara tidak dapat mereview' } });
  assert.equal(treasurerResolve.statusCode, 403);
  const resolve = await app.inject({ method: 'PATCH', url: '/api/cash/disputes/dispute-1', headers: { authorization: `Bearer ${teacher}` }, payload: { status: 'resolved', review_note: 'Bukti telah diverifikasi' } });
  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.json().data.dispute.status, 'approved');

  const member = app.jwt.sign({ userId: 'usr-3', username: 'member', role: 'member', studentId: 'student-1', isFirstLogin: false });
  const quota = await app.inject({ method: 'GET', url: '/api/cash/disputes/quota', headers: { authorization: `Bearer ${member}` } });
  assert.equal(quota.statusCode, 200);
  assert.equal(quota.json().data.remaining, 1);
  const evidence = await app.inject({ method: 'GET', url: '/api/cash/disputes/dispute-1/evidence', headers: { authorization: `Bearer ${member}` } });
  assert.equal(evidence.statusCode, 200);
  assert.equal(evidence.json().data.url, 'data:image/jpeg;base64,proof');
});
