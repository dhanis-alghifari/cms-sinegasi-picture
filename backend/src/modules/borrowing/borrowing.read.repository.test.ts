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

test('borrowing search asks Postgres for exact total and only hydrates IDs on the requested page', async () => {
  let rpcName = '';
  let rpcArgs: Record<string, unknown> | undefined;
  const tableCalls: Array<[string, ...unknown[]]> = [];
  const pageRow = {
    id: 'borrowing-page-2', student_id: 'student-1', status: 'borrowed', created_at: '2026-05-01T00:00:00.000Z',
    due_at: '2026-05-02T00:00:00.000Z', tanggal_pinjam: '2026-05-01', rencana_kembali: '2026-05-02', keperluan: 'Produksi',
    students: { id: 'student-1', nama: 'Rani', nis: '20260001', kelas: 'XI' }, borrowing_items: [],
  };
  const queryBuilder = {
    select(...args: unknown[]) { tableCalls.push(['select', ...args]); return this; },
    in(...args: unknown[]) { tableCalls.push(['in', ...args]); return this; },
    then(resolve: (value: { data: typeof pageRow[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: tableCalls.some(([method]) => method === 'in') ? [pageRow] : [], error: null }).then(resolve, reject);
    },
  };
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcName = name;
      rpcArgs = args;
      return { data: { ids: ['borrowing-page-2'], total: 16 }, error: null };
    },
    from: (table: string) => { tableCalls.push(['from', table]); return queryBuilder; },
  };
  const repository = createBorrowingReadRepository(client as never);

  const response = await repository.list(
    { search: 'Rani', status: 'dipinjam', borrower_id: 'student-filter', page: '2', pageSize: '10' },
    { studentId: null },
  );

  assert.equal(response.error, null);
  assert.equal(rpcName, 'search_borrowings_page_ids');
  assert.equal(rpcArgs?.p_search, 'Rani');
  assert.equal(rpcArgs?.p_status, 'borrowed');
  assert.equal(rpcArgs?.p_borrower_id, 'student-filter');
  assert.equal(rpcArgs?.p_limit, 10);
  assert.equal(rpcArgs?.p_offset, 10);
  assert.deepEqual(tableCalls.find(([method]) => method === 'in'), ['in', 'id', ['borrowing-page-2']]);
  assert.equal(response.data?.total, 16);
  assert.equal(response.data?.page, 2);
  assert.equal(response.data?.data[0]?.borrower_nama, 'Rani');
});
