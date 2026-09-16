import assert from 'node:assert/strict';
import test from 'node:test';
import { CashReadService, CashReadServiceError } from './cash.read.service.js';
import type { CashReadRepository } from './cash.read.repository.js';

function repository(overrides: Partial<CashReadRepository> = {}): CashReadRepository {
  return {
    isConfigured: () => false,
    getSummary: async () => ({
      data: { saldoUtama: 100000, totalPemasukan: 150000, totalPengeluaran: 50000, totalTunggakanSiswa: 25000 },
      error: null,
    }),
    listTransactions: async () => ({ data: [], count: 0, error: null }),
    ...overrides,
  };
}

test('cash read service preserves summary fields from the repository', async () => {
  const service = new CashReadService(repository());
  const summary = await service.getSummary({ studentId: null });

  assert.deepEqual(summary, {
    saldoUtama: 100000,
    totalPemasukan: 150000,
    totalPengeluaran: 50000,
    totalTunggakanSiswa: 25000,
  });
});

test('cash read service maps transactions and calculates bounded pagination', async () => {
  const service = new CashReadService(repository({
    listTransactions: async () => ({
      data: [{
        id: 'cash-1',
        type: 'pemasukan',
        nominal: 50000,
        keterangan: 'Iuran kelas',
        tanggal: '2026-08-11',
        idempotency_key: 'idem-1',
        created_at: '2026-08-11T08:00:00.000Z',
        students: [{ id: 'student-1', nama: 'Ayu' }],
        cash_payment_methods: [{ code: 'qris_dana', label: 'QRIS DANA' }],
      }],
      count: 101,
      error: null,
    }),
  }));

  const result = await service.listTransactions({ page: '2', pageSize: '100' }, { studentId: null });
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 100);
  assert.equal(result.totalPages, 2);
  assert.equal(result.data[0].student_nama, 'Ayu');
  assert.equal(result.data[0].metode_pembayaran, 'qris_dana');
});

test('cash read service rejects invalid filters before repository access', async () => {
  let called = false;
  const service = new CashReadService(repository({
    listTransactions: async () => {
      called = true;
      return { data: [], count: 0, error: null };
    },
  }));

  await assert.rejects(
    service.listTransactions({ tanggal_mulai: '11-08-2026' }, { studentId: null }),
    (error: unknown) => error instanceof CashReadServiceError && error.statusCode === 422,
  );
  await assert.rejects(
    service.listTransactions({ metode_pembayaran: 'qris dana' }, { studentId: null }),
    (error: unknown) => error instanceof CashReadServiceError && error.errorCode === 'INVALID_PAYMENT_METHOD',
  );
  await assert.rejects(
    service.listTransactions({ student_id: 'student-bukan-uuid' }, { studentId: null }),
    (error: unknown) => error instanceof CashReadServiceError && error.errorCode === 'INVALID_STUDENT_ID',
  );
  assert.equal(called, false);
});

test('cash read service maps missing database schema to a temporary-unavailable response', async () => {
  const service = new CashReadService(repository({
    getSummary: async () => ({ data: null, error: { code: 'PGRST205', message: 'cash_payment_methods missing' } }),
  }));

  await assert.rejects(
    service.getSummary({ studentId: null }),
    (error: unknown) => error instanceof CashReadServiceError
      && error.statusCode === 500
      && error.errorCode === 'CASH_SCHEMA_UNAVAILABLE',
  );
});
