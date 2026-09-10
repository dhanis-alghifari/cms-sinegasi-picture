import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('attendance correction migration is atomic, auditable, and service-role only', async () => {
  const sql = await readFile(
    path.resolve(__dirname, '057_attendance_correction_atomic.sql'),
    'utf8',
  );

  for (const token of [
    'correct_attendance_atomic',
    'p_change_reason TEXT',
    'set_config(',
    'app.current_user_id',
    'app.change_reason',
    'FOR UPDATE',
    'ATTENDANCE_NOT_FOUND',
    'updated_by = p_actor_id',
    'REVOKE ALL ON FUNCTION',
    'GRANT EXECUTE ON FUNCTION',
    "NOTIFY pgrst, 'reload schema'",
  ]) assert.ok(sql.includes(token), 'migration is missing: ' + token);

  assert.match(sql, /correct_attendance_atomic\(\s*UUID, TEXT, TEXT, UUID, TEXT\)/);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+/i);
});
