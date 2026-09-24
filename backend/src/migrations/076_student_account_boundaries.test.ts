import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('076 reserves operational roles and provides a restricted explicit-link path', async () => {
  const sql = await readFile(path.resolve(__dirname, '076_student_account_boundaries.sql'), 'utf8');

  assert.match(sql, /v_role NOT IN \('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member'\)/);
  assert.match(sql, /CREATE TRIGGER trg_enforce_user_role_account_boundary/);
  assert.match(sql, /NEW\.role::TEXT NOT IN \('teacher', 'treasurer'\)/);
  assert.match(sql, /OLD\.role::TEXT IN \('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member'\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.list_unlinked_student_accounts/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM public\.students AS s WHERE s\.user_id = u\.id\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.link_existing_student_account_atomic/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.link_account_to_existing_student_atomic/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /p_change_reason/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.list_unlinked_student_accounts[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.link_existing_student_account_atomic[\s\S]+TO service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.link_account_to_existing_student_atomic[\s\S]+TO service_role/);
  assert.doesNotMatch(sql, /password_hash\s*=|temporary_password/i);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});
