import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const sql = readFileSync(path.resolve(__dirname, '067_allow_student_committee_roles.sql'), 'utf8');

test('student committee role migration keeps Teacher exclusive to unlinked accounts', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.update_user_account_atomic/i);
  assert.match(sql, /linked_student_id IS NOT NULL AND requested_role = 'teacher'/i);
  assert.match(sql, /RAISE EXCEPTION 'USER_LINKED_STUDENT_ROLE'/i);
  assert.doesNotMatch(sql, /requested_role <> 'member'/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.update_user_account_atomic[\s\S]+service_role/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_student_with_account_atomic/i);
  assert.match(sql, /v_role NOT IN \(/i);
  assert.match(sql, /v_role::public\.user_role/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_student_with_account_atomic\([^)]*TEXT\)\s+TO service_role/i);
});
