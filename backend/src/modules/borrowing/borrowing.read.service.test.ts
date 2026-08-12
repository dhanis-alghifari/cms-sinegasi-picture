import assert from 'node:assert/strict';
import test from 'node:test';
import { BorrowingReadService, BorrowingReadServiceError } from './borrowing.read.service.js';
import { createBorrowingReadRepository } from './borrowing.read.repository.js';

test('borrowing read service keeps bounded memory fallback and validates status', async () => {
  const service = new BorrowingReadService(createBorrowingReadRepository(null));
  const result = await service.list({ page: '1', pageSize: '100' }, { studentId: 'student-1' });
  assert.equal(result.totalPages, 1);
  await assert.rejects(() => service.list({ status: 'unknown' }, { studentId: null }), (error: unknown) => error instanceof BorrowingReadServiceError && error.statusCode === 422);
});
