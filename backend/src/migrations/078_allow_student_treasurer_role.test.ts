import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('078 allows treasurer student accounts without widening operational boundaries', async () => {
  const sql = await readFile(path.resolve(__dirname, '078_allow_student_treasurer_role.sql'), 'utf8');

  assert.match(sql, /public\.create_student_with_account_atomic/);
  assert.match(sql, /public\.enforce_user_role_account_boundary/);
  assert.match(sql, /public\.list_unlinked_student_accounts/);
  assert.match(sql, /public\.link_existing_student_account_atomic/);
  assert.match(sql, /public\.link_account_to_existing_student_atomic/);
  assert.match(sql, /'secretary', 'treasurer', 'equipment_team'/);
  assert.match(sql, /NEW\.role::TEXT NOT IN/);
  assert.doesNotMatch(sql, /OLD\.role::TEXT IN \([^)]*'treasurer'/);
  assert.match(sql, /pg_catalog\.pg_get_functiondef/);
  assert.match(sql, /STUDENT_TREASURER_EXPECTED_ONE_ROLE_CHECK/);
  assert.match(sql, /STUDENT_TREASURER_ROLE_CHECK_UPDATE_FAILED/);
  assert.match(sql, /STUDENT_TREASURER_FUNCTION_SECURITY_CHANGED/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});
