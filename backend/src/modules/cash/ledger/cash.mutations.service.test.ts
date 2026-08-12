import assert from 'node:assert/strict';
import test from 'node:test';
import { CashMutationsService, CashMutationsServiceError } from './cash.mutations.service.js';
import { createCashMutationsRepository } from './cash.mutations.repository.js';
import type { CashMutationMemoryState } from './cash.mutations.types.js';

function state(): CashMutationMemoryState {
  const now = new Date().toISOString();
  return {
    transactions: [],
    debts: [],
    students: [{ id: 'student-1', nama: 'Ayu', is_active: true }],
    paymentMethods: [{ id: 'cash-1', code: 'cash', label: 'Cash', is_active: true, sort_order: 10, created_at: now, updated_at: now }],
    billingRules: { nominal_iuran_wajib: 5000 },
  };
}

test('cash mutation service records income and replays the same idempotency key', async () => {
  const memory = state();
  const service = new CashMutationsService(createCashMutationsRepository(null, memory));
  const first = await service.recordIn({ nominal: 5000, student_id: 'student-1', type: 'iuran_wajib', tanggal: '2026-08-11', metode_pembayaran: 'cash' }, 'user-1', 'cash-in-1');
  const replay = await service.recordIn({ nominal: 5000, student_id: 'student-1', type: 'iuran_wajib', tanggal: '2026-08-11', metode_pembayaran: 'cash' }, 'user-1', 'cash-in-1');

  assert.equal(memory.transactions.length, 1);
  assert.equal(first.cashTransaction?.jumlah, 5000);
  assert.equal(replay.result?.already_recorded, true);
});

test('cash mutation service creates an unpaid weekly debt for a zero-value billing entry', async () => {
  const memory = state();
  const service = new CashMutationsService(createCashMutationsRepository(null, memory));
  const result = await service.recordIn({ nominal: 0, student_id: 'student-1', type: 'iuran_wajib', tanggal: '2026-08-11' }, 'user-1', 'cash-debt-1');

  assert.equal(memory.debts.length, 1);
  assert.equal(result.result?.payment_status, 'unpaid');
  assert.equal(result.result?.amount_outstanding, 5000);
});

test('cash mutation service rejects an expense larger than the current balance', async () => {
  const service = new CashMutationsService(createCashMutationsRepository(null, state()));
  await assert.rejects(
    service.recordOut({ nominal: 1000, keterangan: 'Beli perlengkapan' }, 'user-1', 'cash-out-1'),
    (error: unknown) => error instanceof CashMutationsServiceError && error.statusCode === 400 && error.errorCode === 'INSUFFICIENT_BALANCE',
  );
});

test('cash mutation service validates payment method and calendar date before persistence', async () => {
  const service = new CashMutationsService(createCashMutationsRepository(null, state()));
  await assert.rejects(
    service.recordIn({ nominal: 1000, type: 'pemasukan', tanggal: '2026-99-99' }, 'user-1'),
    (error: unknown) => error instanceof CashMutationsServiceError && error.errorCode === 'INVALID_DATE',
  );
  await assert.rejects(
    service.recordOut({ nominal: 1000, keterangan: 'Beli perlengkapan', metode_pembayaran: 'qris dana' }, 'user-1'),
    (error: unknown) => error instanceof CashMutationsServiceError && error.errorCode === 'INVALID_PAYMENT_METHOD',
  );
});
