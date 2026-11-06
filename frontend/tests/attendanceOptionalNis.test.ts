import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeAttendanceList, decodeAttendanceRoster } from '../src/features/attendance/api/attendance.responses';

const pagination = { success: true, total: 1, page: 1, pageSize: 10, totalPages: 1 };

test('attendance records remain readable when a student has no NIS', () => {
  const result = decodeAttendanceList({
    ...pagination,
    data: [{
      id: 'attendance-1', student_id: 'student-1', student_nis: '',
      student_nama: 'Siswa', kelas: 'X', tanggal: '2026-11-06',
      status: 'hadir', is_locked: false, created_at: '2026-11-06T00:00:00Z',
    }],
  });
  assert.equal(result.data[0]?.student_nis, '');
});

test('attendance roster normalizes missing NIS without losing a provided NIS', () => {
  const withoutNis = decodeAttendanceRoster({ ...pagination, data: [{ student_id: 'student-1', nis: null, nama: 'Siswa', kelas: 'X' }] });
  const withNis = decodeAttendanceRoster({ ...pagination, data: [{ student_id: 'student-2', nis: '00123', nama: 'Siswa', kelas: 'X' }] });
  assert.equal(withoutNis.data[0]?.nis, '');
  assert.equal(withNis.data[0]?.nis, '00123');
});
