import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeStudent, decodeStudentOptions } from '../src/features/students/api/students.responses';
import { studentSchema } from '../src/features/students/schemas/studentSchema';
import { studentResetTarget } from '../src/features/students/utils/studentResetTarget';
import { toStudentRequest } from '../src/features/students/api/students.requests';
import type { Student } from '../src/features/students/types/students.types';

const student: Student = {
  id: 'profile-id', user_id: 'account-id', username: 'rara', nis: null,
  nama: 'Rara', kelas: 'XII TB 1', is_active: true, created_at: '2026-01-01',
};

test('student decoder accepts nullable NIS and linked username without exposing a fake value', () => {
  assert.equal(decodeStudent(student).nis, null);
  assert.equal(decodeStudent(student).username, 'rara');
  assert.equal(decodeStudent({ ...student, nis: '001234' }).nis, '001234');
  const options = decodeStudentOptions({ success: true, data: [{ id: student.id, nis: null, nama: student.nama, kelas: student.kelas, label: student.nama, secondaryLabel: student.kelas }], total: 1 });
  assert.equal(options.data[0]?.nis, null);
});

test('NIS is optional and still constrained when present', () => {
  const values = { nis: '  ', nama: 'Rara', kelas: 'XII TB 1' };
  assert.equal(studentSchema.parse(values).nis, '');
  assert.equal(studentSchema.parse({ ...values, nis: ' 00123 ' }).nis, '00123');
  assert.equal(studentSchema.safeParse({ ...values, nis: '--' }).success, false);
  assert.equal(studentSchema.safeParse({ ...values, nis: 'a'.repeat(41) }).success, false);
});

test('password reset target requires permission, linked account and username', () => {
  assert.deepEqual(studentResetTarget(student, true), { id: 'account-id', username: 'rara', nama: 'Rara' });
  assert.equal(studentResetTarget(student, false), null);
  assert.equal(studentResetTarget({ ...student, user_id: undefined }, true), null);
  assert.equal(studentResetTarget({ ...student, username: undefined }, true), null);
});

test('update request distinguishes an omitted NIS from explicitly clearing it', () => {
  assert.deepEqual(toStudentRequest({ nama: 'Rara' }), { name: 'Rara' });
  assert.deepEqual(toStudentRequest({ nis: null }), { student_number: null });
  assert.deepEqual(toStudentRequest({ nis: '00123' }), { student_number: '00123' });
});
