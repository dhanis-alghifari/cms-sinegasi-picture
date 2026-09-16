import assert from 'node:assert/strict';
import test from 'node:test';
import { CashReportingService, CashReportingServiceError } from './cash.reporting.service.js';
import { createCashReportingRepository } from './cash.reporting.repository.js';

test('cash reporting memory adapter returns bounded report and member-scoped debts', async () => {
  const repository = createCashReportingRepository(null, {
    transactions: [
      {
        id: 'tx-1', type: 'iuran_wajib', nominal: 5000, keterangan: 'Iuran', tanggal: '2026-08-01', student_id: 'student-1',
        idempotency_key: 'id-1', created_by: 'teacher-1', created_at: '2026-08-01T08:00:00.000Z', is_billing: false,
        payment_method_code: 'cash', payment_method_label: 'Cash',
      },
    ],
    debts: [
      { id: 'debt-1', student_id: 'student-1', amount: 10000, status: 'unpaid', keterangan: 'Agustus', periode: '2026-08', idempotency_key: 'debt-1', created_at: '2026-08-01T08:00:00.000Z' },
      { id: 'debt-2', student_id: 'student-2', amount: 20000, status: 'unpaid', keterangan: 'Agustus', periode: '2026-08', idempotency_key: 'debt-2', created_at: '2026-08-01T08:00:00.000Z' },
    ],
    students: [{ id: 'student-1', nama: 'Siswa Satu', nis: '001', kelas: 'X' }],
    paymentMethods: [],
    billingRules: { nominal_iuran_wajib: 5000, holiday_start_date: null, holiday_end_date: null, skip_week: false },
  });
  const service = new CashReportingService(repository);
  const report = await service.getReport({ start_date: '2026-08-01', end_date: '2026-08-01' });
  assert.equal(report?.summary && (report.summary as Record<string, number>).total_income, 5000);
  const debts = await service.listDebts({ page: '1', pageSize: '1' }, { studentId: 'student-1' });
  assert.equal(debts.total, 1);
  assert.equal(debts.data[0].student_nama, 'Siswa Satu');
});

test('cash reporting validates report ranges and billing changes', async () => {
  const repository = createCashReportingRepository(null, {
    transactions: [], debts: [], students: [], paymentMethods: [],
    billingRules: { nominal_iuran_wajib: 5000, holiday_start_date: null, holiday_end_date: null, skip_week: false },
  });
  const service = new CashReportingService(repository);
  await assert.rejects(() => service.getReport({ start_date: '2026-01-01', end_date: '2026-04-01' }), (error: unknown) => error instanceof CashReportingServiceError && error.statusCode === 422);
  await assert.rejects(() => service.listDebts({ student_id: 'not-a-uuid' }, { studentId: null }), (error: unknown) => error instanceof CashReportingServiceError && error.errorCode === 'INVALID_STUDENT_ID');
  await assert.rejects(() => service.updateBillingRules({ nominal_iuran_wajib: 100 }, 'teacher-1', 'ubah'), (error: unknown) => error instanceof CashReportingServiceError && error.statusCode === 422);
  const result = await service.updateBillingRules({ nominal_iuran_wajib: 6000 }, 'teacher-1', 'Perubahan nominal');
  assert.equal(result?.nominal_iuran_wajib, 6000);
});
