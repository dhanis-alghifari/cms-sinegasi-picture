import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('equipment mutation migration is atomic, auditable, and service-role only', async () => {
  const sql = await readFile(
    path.resolve(__dirname, '056_equipment_mutations_atomic.sql'),
    'utf8',
  );

  for (const token of [
    'update_equipment_atomic',
    'update_equipment_condition_atomic',
    'delete_equipment_atomic',
    'p_change_reason TEXT',
    "set_config('app.current_user_id'",
    "set_config('app.change_reason'",
    "set_config('app.skip_legacy_audit'",
    'public.write_audit_log',
    'FOR UPDATE',
    'EQUIPMENT_NOT_FOUND',
    'REVOKE ALL ON FUNCTION',
    'GRANT EXECUTE ON FUNCTION',
    "NOTIFY pgrst, 'reload schema'",
  ]) assert.ok(sql.includes(token), 'migration is missing: ' + token);

  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.update_equipment_atomic\(\s*UUID, JSONB, UUID, TEXT, UUID, UUID, TEXT\s*\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.update_equipment_condition_atomic\(\s*UUID, TEXT, UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT\s*\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.delete_equipment_atomic\(\s*UUID, UUID, TEXT, UUID, UUID, TEXT\s*\)/);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+/i);
});
