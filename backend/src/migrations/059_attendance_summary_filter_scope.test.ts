import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const migrationPath = path.resolve(__dirname, '059_attendance_summary_filter_scope.sql');

test('attendance summary migration accepts the same filters as the attendance list', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /p_kelas TEXT DEFAULT NULL/);
  assert.match(migration, /p_status TEXT DEFAULT NULL/);
  assert.match(migration, /p_search TEXT DEFAULT NULL/);
  assert.match(migration, /INNER JOIN public\.students AS s ON s\.id = a\.student_id/);
  assert.match(migration, /p_kelas IN \('X', 'XI', 'XII'\)/);
  assert.match(migration, /s\.kelas ILIKE p_kelas \|\| ' %'/);
  assert.match(migration, /a\.status = p_status/);
  assert.match(migration, /s\.nama ILIKE '%' \|\| p_search \|\| '%'/);
  assert.match(migration, /s\.nis ILIKE '%' \|\| p_search \|\| '%'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_attendance_summary_filtered\(UUID, DATE, DATE, TEXT, TEXT, TEXT\)/);
});
