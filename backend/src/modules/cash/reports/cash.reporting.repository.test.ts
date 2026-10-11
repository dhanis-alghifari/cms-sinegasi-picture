import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCashReportingRepository, projectLegacyDisputesOntoDebts } from './cash.reporting.repository.js';

const studentId = '4e9cd646-633a-4741-9ed5-9c8f38a0290b';

function debt(id: string, createdAt: string, amount = 5000) {
  return {
    id,
    student_id: studentId,
    amount,
    status: 'unpaid' as const,
    keterangan: 'Iuran mingguan belum dibayar',
    periode: '2026-37',
    idempotency_key: `debt-${id}`,
    created_at: createdAt,
  };
}

test('cash debt adapter selects only columns present on debt_records', async () => {
  let selectedColumns = '';
  let orderCalls = 0;
  const query = {
    select(selection: string) {
      selectedColumns = selection;
      return this;
    },
    eq() {
      return this;
    },
    range() {
      return this;
    },
    order() {
      orderCalls += 1;
      return orderCalls === 2 ? Promise.resolve({ data: [], count: 0, error: null }) : this;
    },
  };
  const client = {
    from(table: string) {
      assert.equal(table, 'debt_records');
      return query;
    },
  } as unknown as SupabaseClient;

  const repository = createCashReportingRepository(client, {
    transactions: [],
    debts: [],
    students: [],
    paymentMethods: [],
    billingRules: {
      nominal_iuran_wajib: 5000,
      holiday_start_date: null,
      holiday_end_date: null,
      skip_week: false,
    },
  });

  const result = await repository.listDebts({ page: '1', pageSize: '10' }, { studentId: null });

  assert.equal(result.error, null);
  assert.equal(result.data?.total, 0);
  assert.equal(/(^|,)tanggal(,|$)/.test(selectedColumns), false);
  assert.match(selectedColumns, /created_at/);
});

test('legacy transaction dispute is projected only onto the matching debt row', () => {
  const projected = projectLegacyDisputesOntoDebts(
    [
      debt('debt-21', '2026-09-20T20:03:52.106646+00:00'),
      debt('debt-19', '2026-09-19T11:37:44.436987+00:00'),
    ],
    [{
      id: 'dispute-19',
      transaction_id: 'transaction-19',
      student_id: studentId,
      status: 'pending',
      reason: 'salah catat',
      attempt_number: 1,
      created_at: '2026-09-20T20:04:42.111019+00:00',
      cash_transactions: {
        student_id: studentId,
        type: 'iuran_wajib',
        nominal: 5000,
        tanggal: '2026-09-19',
      },
    }],
  );

  assert.equal(projected[0]?.dispute, undefined);
  assert.equal(projected[1]?.dispute?.id, 'dispute-19');
  assert.equal(projected[1]?.dispute?.status, 'pending');
});

test('ambiguous legacy transaction matches stay actionable', () => {
  const projected = projectLegacyDisputesOntoDebts(
    [
      debt('debt-a', '2026-09-19T11:37:44.436987+00:00'),
      debt('debt-b', '2026-09-19T12:37:44.436987+00:00'),
    ],
    [{
      id: 'dispute-19',
      transaction_id: 'transaction-19',
      student_id: studentId,
      status: 'pending',
      created_at: '2026-09-20T20:04:42.111019+00:00',
      cash_transactions: { student_id: studentId, type: 'iuran_wajib', nominal: 5000, tanggal: '2026-09-19' },
    }],
  );

  assert.equal(projected.every((item) => item.dispute === undefined), true);
});

test('debt endpoint exposes a legacy transaction dispute on the matching row only', async () => {
  const debtRows = [
    { id: 'debt-21', student_id: studentId, amount: 5000, status: 'unpaid', keterangan: 'Iuran mingguan belum dibayar', periode: '2026-39', idempotency_key: 'debt-21', created_at: '2026-09-20T20:03:52.106646+00:00', cash_disputes: [] },
    { id: 'debt-19', student_id: studentId, amount: 5000, status: 'unpaid', keterangan: 'Iuran mingguan belum dibayar', periode: '2026-37', idempotency_key: 'debt-19', created_at: '2026-09-19T11:37:44.436987+00:00', cash_disputes: [] },
  ];
  const legacyRows = [{
    id: 'dispute-19',
    transaction_id: 'transaction-19',
    student_id: studentId,
    status: 'pending',
    reason: 'salah catat',
    attempt_number: 1,
    created_at: '2026-09-20T20:04:42.111019+00:00',
    cash_transactions: { student_id: studentId, type: 'iuran_wajib', nominal: 5000, tanggal: '2026-09-19' },
  }];
  const makeQuery = (result: unknown) => {
    const query: any = {
      select: () => query,
      eq: () => query,
      in: () => query,
      ilike: () => query,
      range: () => query,
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  };
  const client = {
    from(table: string) {
      if (table === 'debt_records') return makeQuery({ data: debtRows, count: 2, error: null });
      if (table === 'cash_disputes') return makeQuery({ data: legacyRows, count: 1, error: null });
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  const repository = createCashReportingRepository(client, {
    transactions: [],
    debts: [],
    students: [],
    paymentMethods: [],
    billingRules: { nominal_iuran_wajib: 5000, holiday_start_date: null, holiday_end_date: null, skip_week: false },
  });
  const result = await repository.listDebts({ page: '1', pageSize: '10' }, { studentId });

  assert.equal(result.error, null);
  assert.equal(result.data?.data[0]?.dispute, undefined);
  assert.equal(result.data?.data[1]?.dispute?.id, 'dispute-19');
});
