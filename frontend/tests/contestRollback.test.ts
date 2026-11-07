import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeContestListResponse } from '../src/features/contests/api/contests.responses';

test('rollback frontend can read contests without a deadline', () => {
  const result = decodeContestListResponse({
    success: true,
    data: [{ id: 'contest-1', nama_lomba: 'Festival', tingkat: 'umum', status: 'selesai', deadline: null }],
    total: 1, page: 1, pageSize: 10, totalPages: 1,
  });
  assert.equal(result.data[0]?.deadline, null);
});
