import assert from 'node:assert/strict';
import test from 'node:test';
import { AttendanceService, AttendanceServiceError } from './attendance.service.js';
import type { AttendanceCorrectionInput, AttendanceRepository } from './attendance.repository.js';

function repository(overrides: Partial<AttendanceRepository> = {}): AttendanceRepository {
  return {
    isConfigured: () => false,
    list: async () => ({ data: [], count: 0, error: null }),
    roster: async () => ({ data: [], count: 0, error: null }),
    summary: async () => ({ data: { hadir: 1, sakit: 0, izin: 0, alpha: 0, total: 1 }, error: null }),
    record: async (input) => ({ data: { id: 'att-1', ...input }, error: null }),
    batchRecord: async (input) => ({
      data: input.records.map((record, index) => ({ id: `att-${index + 1}`, ...record })),
      error: null,
    }),
    correct: async (input) => ({ data: { id: input.attendanceId, ...input }, error: null }),
    ...overrides,
  };
}

test('attendance service applies bounded pagination and calculates total pages', async () => {
  const service = new AttendanceService(repository({
    list: async () => ({
      data: [{
        id: 'att-1',
        student_id: 'student-1',
        student_nis: '001',
        student_nama: 'Ari',
        kelas: 'X TKJ',
        tanggal: '2026-08-13',
        status: 'hadir',
        keterangan: null,
        is_locked: false,
        idempotency_key: 'attendance-1',
        created_by: null,
        created_at: '2026-08-13T07:00:00.000Z',
        updated_by: null,
        updated_at: null,
      }],
      count: 101,
      error: null,
    }),
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

test('attendance service returns roster pagination metadata', async () => {
  const service = new AttendanceService(repository({
    roster: async () => ({
      data: [{ student_id: 'student-1', nis: '001', nama: 'Ari', kelas: 'X TKJ' }],
      count: 11,
      error: null,
    }),
  }));
  const result = await service.roster({ tanggal: '2026-08-13', kelas: 'X', page: 2, pageSize: 10 });
  assert.equal(result.total, 11);
  assert.equal(result.totalPages, 2);
  assert.equal(result.data[0]?.student_id, 'student-1');
});

test('attendance service rejects missing non-present notes before repository access', async () => {
  const service = new AttendanceService(repository({
    batchRecord: async () => { throw new Error('repository should not be called'); },
  }));
  await assert.rejects(
    service.batchRecord({
      tanggal: '2026-08-13',
      kelas: 'X',
      actorId: 'user-1',
      records: [
        { student_id: 'student-1', status: 'izin' },
      ],
    }),
    (error: unknown) => error instanceof AttendanceServiceError && error.errorCode === 'REQUIRED_NOTE',
  );
});

test('attendance service rejects duplicate students before repository access', async () => {
  const service = new AttendanceService(repository({
    batchRecord: async () => { throw new Error('repository should not be called'); },
  }));
  await assert.rejects(
    service.batchRecord({
      tanggal: '2026-08-13',
      kelas: 'X',
      actorId: 'user-1',
      records: [
        { student_id: 'student-1', status: 'hadir' },
        { student_id: 'student-1', status: 'hadir' },
      ],
    }),
    (error: unknown) => error instanceof AttendanceServiceError && error.errorCode === 'DUPLICATE_STUDENT',
  );
});

test('attendance service delegates a valid batch and returns its count', async () => {
  let received = 0;
  const service = new AttendanceService(repository({
    batchRecord: async (input) => {
      received = input.records.length;
      return { data: input.records.map((record) => ({ id: 'att-1', ...record })), error: null };
    },
  }));
  const result = await service.batchRecord({
    tanggal: '2026-08-13',
    kelas: 'X',
    actorId: 'user-1',
    records: [{ student_id: 'student-1', status: 'hadir' }],
  });
  assert.equal(received, 1);
  assert.equal(result.total, 1);
});

test('attendance service rejects an inverted reporting date range', async () => {
  const service = new AttendanceService(repository({
    list: async () => { throw new Error('repository should not be called'); },
  }));

  await assert.rejects(
    service.list({
      date_from: '2026-09-30',
      date_to: '2026-09-01',
      page: 1,
      pageSize: 50,
    }),
    (error: unknown) => error instanceof AttendanceServiceError
      && error.statusCode === 422
      && error.errorCode === 'INVALID_DATE_RANGE',
  );
});

test('attendance service normalizes and forwards correction audit context', async () => {
  let received: AttendanceCorrectionInput | undefined;
  const service = new AttendanceService(repository({
    correct: async (input) => {
      received = input;
      return { data: { id: input.attendanceId, status: input.status }, error: null };
    },
  }));

  await service.correct({
    attendanceId: 'attendance-1',
    status: ' SAKIT ',
    keterangan: '  Surat sakit  ',
    actorId: 'teacher-1',
    changeReason: '  Surat sakit terlambat diserahkan  ',
  });

  assert.deepEqual(received, {
    attendanceId: 'attendance-1',
    status: 'sakit',
    keterangan: 'Surat sakit',
    actorId: 'teacher-1',
    changeReason: 'Surat sakit terlambat diserahkan',
  });
});

test('attendance service rejects a non-present correction without a note', async () => {
  const service = new AttendanceService(repository({
    correct: async () => { throw new Error('repository should not be called'); },
  }));

  await assert.rejects(
    service.correct({
      attendanceId: 'attendance-1',
      status: 'sakit',
      actorId: 'teacher-1',
      changeReason: 'Koreksi status',
    }),
    (error: unknown) => error instanceof AttendanceServiceError
      && error.statusCode === 422
      && error.errorCode === 'REQUIRED_NOTE',
  );
});

test('attendance service maps a missing correction row to 404 and preserves database diagnostics', async () => {
  const service = new AttendanceService(repository({
    correct: async () => ({
      data: null,
      error: { code: 'P0002', message: 'ATTENDANCE_NOT_FOUND' },
    }),
  }));

  await assert.rejects(
    service.correct({
      attendanceId: 'missing-attendance',
      status: 'hadir',
      actorId: 'teacher-1',
      changeReason: 'Koreksi data lama',
    }),
    (error: unknown) => error instanceof AttendanceServiceError
      && error.statusCode === 404
      && error.errorCode === 'ATTENDANCE_NOT_FOUND'
      && error.databaseError?.code === 'P0002',
  );
});
