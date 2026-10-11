import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('088 adds one-time replay-safe student account issuance with narrow database access', async () => {
  const sql = await readFile(path.resolve(__dirname, '088_student_account_onboarding.sql'), 'utf8');

  assert.match(sql, /GROUP BY lower\(btrim\(username\)\)[\s\S]+STUDENT_ACCOUNT_USERNAME_NORMALIZATION_COLLISION/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_normalized[\s\S]+ON public\.users \(lower\(btrim\(username\)\)\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.student_account_operations[\s\S]+PRIMARY KEY \(actor_id, operation_key\)/);
  assert.doesNotMatch(sql.match(/CREATE TABLE IF NOT EXISTS public\.student_account_operations \(([\s\S]*?)\n\);/)?.[1] ?? '', /password|phone/i);
  assert.match(sql, /ALTER TABLE public\.student_account_operations ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.student_account_operations FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.student_account_operations FROM service_role/);
  assert.doesNotMatch(sql, /GRANT [^;]+ ON TABLE public\.student_account_operations TO service_role/i);

  for (const functionName of ['create_student_with_account_v2', 'provision_student_account_v2']) {
    const functionStart = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
    assert.notEqual(functionStart, -1, `${functionName} should exist`);
    const functionEnd = sql.indexOf('\n$$;', functionStart);
    const definition = sql.slice(functionStart, functionEnd);
    assert.match(definition, /SECURITY DEFINER/);
    assert.match(definition, /SET search_path = ''/);
    assert.match(definition, /'students\.manage'/);
    assert.match(definition, /operation_replayed/);
    assert.match(definition, /STUDENT_OPERATION_KEY_REUSED/);
    assert.match(definition, /USERNAME_TAKEN/);
    assert.match(definition, /p_change_reason/);
    assert.match(definition, /public\.write_audit_log/);
    assert.match(definition, /'is_first_login', TRUE/);
    assert.doesNotMatch(definition, /temporary_password/i);
  }

  assert.match(sql, /REVOKE ALL ON FUNCTION public\.create_student_with_account_v2[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_student_with_account_v2[\s\S]+TO service_role/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.provision_student_account_v2[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.provision_student_account_v2[\s\S]+TO service_role/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});
