import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCashReportingRepository } from './cash.reporting.repository.js';

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
