import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('attendance reporting migration defines a bounded filtered aggregate', async () => {
  const migration = await readFile(
    path.resolve(__dirname, '058_attendance_reporting_filters.sql'),
    'utf8',
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_attendance_summary_filtered\(/);
  assert.match(migration, /p_student_id UUID DEFAULT NULL/);
  assert.match(migration, /p_date_from DATE DEFAULT NULL/);
  assert.match(migration, /p_date_to DATE DEFAULT NULL/);
  assert.match(migration, /a\.student_id = p_student_id/);
  assert.match(migration, /a\.tanggal >= p_date_from/);
  assert.match(migration, /a\.tanggal <= p_date_to/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_attendance_summary_filtered/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_attendance_summary_filtered/);
});
