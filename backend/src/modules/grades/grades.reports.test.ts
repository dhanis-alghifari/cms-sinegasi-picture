import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateGradeReport } from './grades.reports.js';

const studentId = '11111111-1111-1111-1111-111111111111';

test('PKL dates are excluded from the effective attendance denominator', () => {
  const result = calculateGradeReport(
    [{ nilai: 'A', dueDate: '2026-08-01' }],
    [
      { tanggal: '2026-08-01', status: 'alpha' },
      { tanggal: '2026-08-02', status: 'hadir' },
    ],
    [{ id: 'pkl-1', student_id: studentId, start_date: '2026-08-01', end_date: '2026-08-01', institution: 'Studio', status: 'approved', created_at: '', updated_at: '' }],
  );

  assert.equal(result.predikat, 'A');
  assert.equal(result.pklDays, 1);
  assert.equal(result.alphaCount, 0);
  assert.equal(result.attendancePercentage, 100);
});

test('missing grade evidence stays ungraded instead of inventing an E', () => {
  const result = calculateGradeReport([], [], []);
  assert.equal(result.predikat, null);
  assert.match(result.deskripsi, /Belum ada bukti penilaian/);
});

test('repeated alpha can cap an otherwise strong average at B', () => {
  const result = calculateGradeReport(
    [{ nilai: 'A', dueDate: '2026-08-01' }, { nilai: 'A', dueDate: '2026-08-02' }],
    [
      { tanggal: '2026-08-01', status: 'alpha' },
      { tanggal: '2026-08-02', status: 'alpha' },
      { tanggal: '2026-08-03', status: 'hadir' },
    ],
    [],
  );
  assert.equal(result.predikat, 'B');
  assert.equal(result.alphaCount, 2);
});
