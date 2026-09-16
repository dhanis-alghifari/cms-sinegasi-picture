import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAttendancePersistence } from './attendance.repository.js';
import { createAttendanceWriteRepository } from './attendance.write.repository.js';

test('attendance persistence keeps read and write adapters independently usable without Supabase', async () => {
  const persistence = createAttendancePersistence(null);

  const list = await persistence.read.list({ page: 1, pageSize: 10 });
  const summary = await persistence.read.summary({});
  const batch = await persistence.write.batchRecord({
    tanggal: '2026-09-10',
    kelas: 'X AK 1',
    actorId: 'teacher-1',
    records: [{ student_id: 'student-1', status: 'hadir' }],
  });

  assert.deepEqual(list, { data: [], count: 0, error: null });
  assert.deepEqual(summary, { data: { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 }, error: null });
  assert.equal(batch.error, null);
  assert.equal(batch.data.length, 1);
  assert.equal(batch.data[0]?.student_id, 'student-1');
});

function createAttendanceClient(insertResult: unknown, replayResult: unknown): SupabaseClient {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({ single: async () => insertResult }),
      }),
      select: () => ({
        eq: () => ({ maybeSingle: async () => replayResult }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const attendanceReplay = {
  id: 'attendance-1',
  student_id: 'student-1',
  tanggal: '2026-09-15',
  status: 'hadir',
  keterangan: null,
  idempotency_key: 'attendance-key-1',
};

test('attendance write treats an identical unique-key retry as an idempotent replay', async () => {
  const repository = createAttendanceWriteRepository(createAttendanceClient(
    { data: null, error: { code: '23505', message: 'duplicate key' } },
    { data: attendanceReplay, error: null },
  ));

  const result = await repository.record({
    studentId: 'student-1',
    tanggal: '2026-09-15',
    status: 'hadir',
    idempotencyKey: 'attendance-key-1',
    actorId: 'teacher-1',
  });

  assert.equal(result.error, null);
  assert.equal(result.data?.id, 'attendance-1');
});

test('attendance write rejects reusing a unique key for a different payload', async () => {
  const repository = createAttendanceWriteRepository(createAttendanceClient(
    { data: null, error: { code: '23505', message: 'duplicate key' } },
    { data: { ...attendanceReplay, status: 'alpha' }, error: null },
  ));

  const result = await repository.record({
    studentId: 'student-1',
    tanggal: '2026-09-15',
    status: 'hadir',
    idempotencyKey: 'attendance-key-1',
    actorId: 'teacher-1',
  });

  assert.equal(result.data, null);
  assert.equal(result.error?.code, 'IDEMPOTENCY_KEY_REUSED');
});
