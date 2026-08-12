import assert from 'node:assert/strict';
import test from 'node:test';
import { AttendanceService, AttendanceServiceError } from './attendance.service.js';
import type { AttendanceRepository } from './attendance.repository.js';

function repository(overrides: Partial<AttendanceRepository> = {}): AttendanceRepository {
  return {
    isConfigured: () => false,
    list: async () => ({ data: [], count: 0, error: null }),
    summary: async () => ({ data: { hadir: 1, sakit: 0, izin: 0, alpha: 0, total: 1 }, error: null }),
    record: async (input) => ({ data: { id: 'att-1', ...input }, error: null }),
    correct: async (input) => ({ data: { id: input.attendanceId, ...input }, error: null }),
    ...overrides,
  };
}

test('attendance service applies bounded pagination and calculates total pages', async () => {
  const service = new AttendanceService(repository({
    list: async () => ({ data: [{ id: 'att-1' }], count: 101, error: null }),
  }));
  const result = await service.list({ page: 2, pageSize: 50 });
  assert.equal(result.total, 101);
  assert.equal(result.totalPages, 3);
  assert.equal(result.data.length, 1);
});

test('attendance service creates a deterministic fallback idempotency key', async () => {
  let receivedKey = '';
  const service = new AttendanceService(repository({
    record: async (input) => {
      receivedKey = input.idempotencyKey;
      return { data: { id: 'att-1' }, error: null };
    },
  }));
  await service.record({ studentId: 'student-1', tanggal: '2026-08-11', status: 'hadir', actorId: 'user-1' });
  assert.equal(receivedKey, 'att-student-1-2026-08-11');
});

test('attendance service rejects incomplete records before repository access', async () => {
  const service = new AttendanceService(repository({
    record: async () => { throw new Error('repository should not be called'); },
  }));
  await assert.rejects(
    service.record({ studentId: '', tanggal: '2026-08-11', status: 'hadir', actorId: 'user-1' }),
    (error: unknown) => error instanceof AttendanceServiceError && error.statusCode === 422,
  );
});
