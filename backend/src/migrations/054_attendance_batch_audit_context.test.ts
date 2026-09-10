import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('attendance batch audit migration keeps compatibility and propagates audit context', async () => {
  const sql = await readFile(
    path.resolve(__dirname, '054_attendance_batch_audit_context.sql'),
    'utf8',
  );

  for (const token of [
    'record_attendance_batch_atomic',
    'p_change_reason TEXT',
    'set_config(',
    'app.current_user_id',
    'app.change_reason',
    'is_active = TRUE',
    'RETURNING id, student_id, tanggal, status, keterangan, is_locked',
    'ON CONFLICT (student_id, tanggal) DO UPDATE',
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), 'migration is missing: ' + token);

  assert.match(sql, /record_attendance_batch_atomic\(\s*DATE, TEXT, JSONB, UUID, TEXT\)/);
  assert.match(sql, /record_attendance_batch_atomic\(\s*DATE, TEXT, JSONB, UUID\)/);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+/i);
});
