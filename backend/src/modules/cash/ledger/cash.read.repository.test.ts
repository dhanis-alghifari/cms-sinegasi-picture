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
