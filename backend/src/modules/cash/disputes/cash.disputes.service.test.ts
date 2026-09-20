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

const proofUrl = `data:image/jpeg;base64,${'A'.repeat(3_000)}`;

test('cash dispute service enforces ownership and duplicate protection', async () => {
  const disputes = service();
  const created = await disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: proofUrl }, 'member-1', 'key-0001', 'student-1');
  assert.equal(created.dispute.status, 'pending');
  await assert.rejects(() => disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: proofUrl }, 'member-1', 'key-0002', 'student-1'), (error: unknown) => error instanceof CashDisputesServiceError && error.statusCode === 409);
  await assert.rejects(() => disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: proofUrl }, 'member-2', 'key-0003', 'student-2'), (error: unknown) => error instanceof CashDisputesServiceError && error.statusCode === 403);
});

test('cash dispute service resolves legacy resolved status to approved', async () => {
  const disputes = service();
  const created = await disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: proofUrl }, 'member-1', 'key-0001', 'student-1');
  const resolved = await disputes.resolve(created.dispute.id, { status: 'resolved', review_note: 'Bukti telah diverifikasi' }, 'teacher-1');
  assert.equal(resolved.dispute.status, 'approved');
});

test('cash dispute service permits one retry after rejection and enforces two monthly attempts', async () => {
  const disputes = service();
  const first = await disputes.create({ transaction_id: 'tx-1', reason: 'Nominal belum sesuai catatan saya', bukti_sanggahan_url: proofUrl }, 'member-1', 'key-0001', 'student-1');
  await disputes.resolve(first.dispute.id, { status: 'rejected', review_note: 'Bukti tidak menunjukkan tanggal pembayaran' }, 'teacher-1');
  const retry = await disputes.create({ transaction_id: 'tx-1', reason: 'Saya lampirkan bukti yang lebih jelas', bukti_sanggahan_url: proofUrl }, 'member-1', 'key-0002', 'student-1');
  assert.equal(retry.dispute.attempt_number, 2);
  await disputes.resolve(retry.dispute.id, { status: 'rejected', review_note: 'Bukti kedua juga belum cukup jelas' }, 'teacher-1');
  await assert.rejects(() => disputes.create({ transaction_id: 'tx-1', reason: 'Pengajuan ketiga seharusnya ditolak', bukti_sanggahan_url: proofUrl }, 'member-1', 'key-0003', 'student-1'), (error: unknown) => error instanceof CashDisputesServiceError && error.statusCode === 429);
});
