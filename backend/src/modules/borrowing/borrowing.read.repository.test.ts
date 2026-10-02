import assert from 'node:assert/strict';
import test from 'node:test';
import { createBorrowingReadRepository } from './borrowing.read.repository.js';

test('overdue borrowing query filters and paginates in PostgREST instead of loading the full borrowed list', async () => {
  const calls: Array<[string, ...unknown[]]> = [];
  const result = { data: [], count: 0, error: null };
  const queryBuilder = {
    select(...args: unknown[]) { calls.push(['select', ...args]); return this; },
    eq(...args: unknown[]) { calls.push(['eq', ...args]); return this; },
    or(...args: unknown[]) { calls.push(['or', ...args]); return this; },
    order(...args: unknown[]) { calls.push(['order', ...args]); return this; },
    range(...args: unknown[]) { calls.push(['range', ...args]); return this; },
    then(resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  const client = { from: (table: string) => { calls.push(['from', table]); return queryBuilder; } };
  const repository = createBorrowingReadRepository(client as never);

  const response = await repository.list({ status: 'terlambat', page: '2', pageSize: '10' }, { studentId: null });

  assert.equal(response.error, null);
  assert.equal(response.data?.page, 2);
  assert.deepEqual(calls.find(([method]) => method === 'eq'), ['eq', 'status', 'borrowed']);
  const overdueFilter = calls.find(([method]) => method === 'or')?.[1];
  assert.equal(typeof overdueFilter, 'string');
  assert.match(String(overdueFilter), /^due_at\.lt\.\d{4}-\d{2}-\d{2}T/);
  assert.match(String(overdueFilter), /and\(due_at\.is\.null,rencana_kembali\.lte\.\d{4}-\d{2}-\d{2}\)$/);
  assert.deepEqual(calls.find(([method]) => method === 'range'), ['range', 10, 19]);
});
