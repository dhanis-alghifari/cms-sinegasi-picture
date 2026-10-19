import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildStudentProfileAuditRehearsal } from '../scripts/studentProfileAuditRehearsal.js';

test('090 adds an invoker-only audited RPC, retains the legacy signature and matches the Supabase migration', async () => {
  const sql = await readFile(path.resolve(__dirname, '090_student_profile_audit_context.sql'), 'utf8');
  const deploymentSql = await readFile(path.resolve(__dirname, '../../../supabase/migrations/20261019135428_student_profile_audit_context.sql'), 'utf8');
  assert.equal(sql, deploymentSql);
  assert.match(sql, /SECURITY INVOKER\s+SET search_path = ''/);
  assert.doesNotMatch(sql, /SECURITY DEFINER|DROP FUNCTION|DISABLE TRIGGER/i);
  assert.match(sql, /rp\.permission_key = 'students\.manage'/);
  assert.match(sql, /v_actor_active IS DISTINCT FROM TRUE/);
  assert.match(sql, /length\(btrim\(p_change_reason\)\) NOT BETWEEN 5 AND 500/);
  assert.match(sql, /set_config\('app\.current_user_id', p_updated_by::TEXT, TRUE\)/);
  assert.match(sql, /set_config\('app\.change_reason', btrim\(p_change_reason\), TRUE\)/);
  assert.match(sql, /set_config\('app\.skip_legacy_audit', 'false', TRUE\)/);
  assert.match(sql, /v_result := public\.update_student_profile_atomic\(/);
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]+TO service_role/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('database rehearsal uses the real baseline functions and refuses existing application databases', async () => {
  const sql = await buildStudentProfileAuditRehearsal();
  assert.match(sql, /current_database\(\) <> 'sinegasi_student_profile_audit_rehearsal'/);
  assert.match(sql, /to_regclass\('public\.users'\) IS NOT NULL/);
  assert.match(sql, /Zero Silent Edits/);
  assert.match(sql, /CREATE TRIGGER trg_audit_users/);
  assert.equal(sql.split('CREATE OR REPLACE FUNCTION public.update_student_profile_audited_atomic(').length - 1, 2);
  assert.match(sql, /SET LOCAL ROLE service_role/);
  assert.match(sql, /ROLLBACK;\s+SELECT 'STUDENT_PROFILE_AUDIT_REHEARSAL_OK'/);
  assert.doesNotMatch(sql, /-- @(?:BASELINE_FUNCTIONS|AUDIT_CONTEXT_MIGRATION)@/);
});
