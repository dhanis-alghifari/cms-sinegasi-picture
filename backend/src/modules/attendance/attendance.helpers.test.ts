import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAttendanceClassFilter, mapAttendanceRow } from './attendance.helpers.js';

test('attendance class-level filter does not treat X as a prefix of XI or XII', () => {
  assert.deepEqual(buildAttendanceClassFilter('X'), {
    kind: 'level',
    expression: 'kelas.eq.X,kelas.ilike.X %',
  });
  assert.deepEqual(buildAttendanceClassFilter('XI'), {
    kind: 'level',
    expression: 'kelas.eq.XI,kelas.ilike.XI %',
  });
  assert.deepEqual(buildAttendanceClassFilter('XII'), {
    kind: 'level',
    expression: 'kelas.eq.XII,kelas.ilike.XII %',
  });
});

test('attendance full-class filter remains an exact match', () => {
  assert.deepEqual(buildAttendanceClassFilter('  XI AK 4  '), {
    kind: 'exact',
    value: 'XI AK 4',
  });
});

test('attendance mapper exposes flat student identity fields', () => {
  const mapped = mapAttendanceRow({
    id: 'attendance-1',
    student_id: 'student-1',
    tanggal: '2026-09-09',
    status: 'hadir',
    keterangan: null,
    is_locked: false,
    idempotency_key: 'attendance-1',
    created_by: 'teacher-1',
    created_at: '2026-09-09T07:00:00.000Z',
    updated_by: null,
    updated_at: null,
    students: { id: 'student-1', nis: '001', nama: 'Siti Aminah', kelas: 'X TKJ' },
  });

  assert.equal(mapped.student_nis, '001');
  assert.equal(mapped.student_nama, 'Siti Aminah');
  assert.equal(mapped.kelas, 'X TKJ');
  assert.equal('students' in mapped, false);
});

test('attendance mapper accepts a one-to-many relation representation', () => {
  const mapped = mapAttendanceRow({
    id: 'attendance-2',
    student_id: 'student-2',
    tanggal: '2026-09-09',
    status: 'izin',
    is_locked: false,
    created_at: '2026-09-09T07:00:00.000Z',
    students: [{ nis: '002', nama: 'Ari', kelas: 'XI DKV' }],
  });

  assert.deepEqual(
    { nis: mapped.student_nis, nama: mapped.student_nama, kelas: mapped.kelas },
    { nis: '002', nama: 'Ari', kelas: 'XI DKV' },
  );
});
