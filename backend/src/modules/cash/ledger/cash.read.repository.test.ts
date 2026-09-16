import assert from 'node:assert/strict';
import test from 'node:test';
import { createCashReadRepository } from './cash.read.repository.js';

test('cash transaction repository disambiguates the transaction dispute relationship', async () => {
  let selection = '';
  const query: any = {
    in: () => query,
    eq: () => query,
    ilike: () => query,
    gte: () => query,
    lt: () => query,
    or: () => query,
    order: () => query,
    range: () => Promise.resolve({ data: [], count: 0, error: null }),
  };
  const client = {
    from(table: string) {
      assert.equal(table, 'cash_transactions');
      return {
        select(select: string) {
          selection = select;
          return query;
        },
      };
    },
  } as any;

  const repository = createCashReadRepository(client, { transactions: [], students: [], debts: [] });
  await repository.listTransactions({ page: '1', pageSize: '5' }, { studentId: null });

  assert.match(selection, /cash_disputes!cash_disputes_transaction_id_fkey\(/);
});

test('cash transaction repository applies the selected student scope before pagination', async () => {
  const selectedStudentId = '11111111-1111-4111-a111-111111111111';
  const repository = createCashReadRepository(null, {
    students: [
      { id: selectedStudentId, nis: '20260001', nama: 'Ayu', kelas: 'X AK 1' },
      { id: '22222222-2222-4222-a222-222222222222', nis: '20260002', nama: 'Bima', kelas: 'X AK 2' },
    ],
    debts: [],
    transactions: [
      {
        id: 'cash-1',
        student_id: selectedStudentId,
        type: 'iuran_wajib',
        nominal: 50_000,
        tanggal: '2026-09-09',
        idempotency_key: 'cash-1-key',
        created_at: '2026-09-09T08:00:00.000Z',
      },
      {
        id: 'cash-2',
        student_id: '22222222-2222-4222-a222-222222222222',
        type: 'iuran_wajib',
        nominal: 50_000,
        tanggal: '2026-09-08',
        idempotency_key: 'cash-2-key',
        created_at: '2026-09-08T08:00:00.000Z',
      },
    ],
  });

  const result = await repository.listTransactions(
    { page: '1', pageSize: '20' },
    { studentId: selectedStudentId },
  );

  assert.equal(result.error, null);
  assert.equal(result.count, 1);
  assert.equal(result.data[0]?.student_id, selectedStudentId);
});
