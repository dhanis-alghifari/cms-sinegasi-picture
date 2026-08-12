import assert from 'node:assert/strict';
import test from 'node:test';
import { CashDisputesService, CashDisputesServiceError } from './cash.disputes.service.js';
import { createCashDisputesRepository } from './cash.disputes.repository.js';

function service() {
  return new CashDisputesService(createCashDisputesRepository(null, {
    transactions: [{
      id: 'tx-1', type: 'iuran_wajib', nominal: 5000, keterangan: 'Iuran', tanggal: '2026-08-01', student_id: 'student-1',
      idempotency_key: 'id-1', created_by: 'teacher-1', created_at: '2026-08-01T08:00:00.000Z', is_billing: false,
      payment_method_code: 'cash', payment_method_label: 'Cash',
    }],
  }));
}

test('cash dispute service enforces ownership and duplicate protection', async () => {
  const disputes = service();
  const created = await disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: 'https://example.test/proof.jpg' }, 'member-1', 'member', 'student-1');
  assert.equal(created.status, 'pending');
  await assert.rejects(() => disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: 'https://example.test/proof.jpg' }, 'member-1', 'member', 'student-1'), (error: unknown) => error instanceof CashDisputesServiceError && error.statusCode === 409);
  await assert.rejects(() => disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: 'https://example.test/proof.jpg' }, 'member-2', 'member', 'student-2'), (error: unknown) => error instanceof CashDisputesServiceError && error.statusCode === 403);
});

test('cash dispute service resolves legacy resolved status to approved', async () => {
  const disputes = service();
  const created = await disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: 'https://example.test/proof.jpg' }, 'member-1', 'member', 'student-1');
  const resolved = await disputes.resolve(created.id, { status: 'resolved' }, 'teacher-1');
  assert.equal(resolved.status, 'approved');
});
