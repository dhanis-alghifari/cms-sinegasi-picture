import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildStudentOptionalNisRehearsal } from '../scripts/studentOptionalNisRehearsal.js';

async function migration(name: string): Promise<string> {
  return readFile(path.resolve(__dirname, name), 'utf8');
}

function functionDefinition(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const end = sql.indexOf('\n$$;', start);
  assert.notEqual(end, -1, `Unterminated ${name}`);
  return sql.slice(start, end + 4);
}

test('091 relaxes NIS without dropping uniqueness or rewriting student data', async () => {
  const sql = await migration('091_student_optional_nis.sql');
  const supabaseSql = await readFile(
    path.resolve(__dirname, '../../../supabase/migrations/20261106132700_student_optional_nis.sql'),
    'utf8',
  );
  assert.equal(sql, supabaseSql);
  assert.match(sql, /ALTER TABLE public\.students ALTER COLUMN nis DROP NOT NULL;/);
  assert.doesNotMatch(sql, /DROP (?:INDEX|CONSTRAINT).*students_nis/i);
  assert.doesNotMatch(sql, /(?:DELETE FROM|TRUNCATE)\s+public\.students/i);
  assert.match(sql, /BEGIN;[\s\S]+COMMIT;/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('create and link functions preserve prior behavior except NIS validation', async () => {
  const [sql, createOriginal, linkOriginal] = await Promise.all([
    migration('091_student_optional_nis.sql'),
    migration('088_student_account_onboarding.sql'),
    migration('076_student_account_boundaries.sql'),
  ]);
  const replacement = "IF (v_nis IS NOT NULL AND (length(v_nis) > 40 OR v_nis !~ '[A-Za-z0-9]'))";
  assert.equal(
    functionDefinition(sql, 'create_student_with_account_v2'),
    functionDefinition(createOriginal, 'create_student_with_account_v2')
      .replace('IF v_nis IS NULL OR length(v_nis) > 40', replacement),
  );
  assert.equal(
    functionDefinition(sql, 'link_existing_student_account_atomic'),
    functionDefinition(linkOriginal, 'link_existing_student_account_atomic')
      .replace('IF v_nis IS NULL OR LENGTH(v_nis) > 40', replacement)
      // Later migrations 078 and 083 expand the account role allowlist.
      .replace(
        "v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')",
        "v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')",
      ),
  );
});

test('new profile RPC enforces actor and audit context without relying on migration 090', async () => {
  const sql = await migration('091_student_optional_nis.sql');
  const fn = functionDefinition(sql, 'update_student_profile_nis_audited_atomic');
  assert.match(fn, /SECURITY INVOKER\s+SET search_path = ''/);
  assert.doesNotMatch(fn, /update_student_profile_audited_atomic\(/);
  assert.match(fn, /permission_key = 'students\.manage'/);
  assert.match(fn, /v_actor_active IS DISTINCT FROM TRUE/);
  assert.match(fn, /length\(btrim\(p_change_reason\)\) NOT BETWEEN 5 AND 500/);
  assert.match(fn, /NULLIF\(btrim\(p_nis\), ''\)/);
  assert.match(fn, /set_config\('app\.current_user_id', p_updated_by::TEXT, TRUE\)/);
  assert.match(fn, /set_config\('app\.change_reason', btrim\(p_change_reason\), TRUE\)/);
  assert.match(fn, /set_config\('app\.skip_legacy_audit', 'false', TRUE\)/);
  assert.match(fn, /FOR UPDATE/);
  assert.match(fn, /SET nis = v_nis/);
  assert.match(fn, /UPDATE public\.users/);
  assert.match(fn, /RETURN to_jsonb\(v_student\)/);
  for (const name of ['update_student_profile_nis_audited_atomic', 'create_student_with_account_v2', 'link_existing_student_account_atomic']) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^;]+FROM PUBLIC, anon, authenticated;`));
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]+TO service_role;`));
  }
});

test('rehearsal emits synthetic SQL guarded to an isolated empty cluster', async () => {
  const sql = await buildStudentOptionalNisRehearsal();
  assert.match(sql, /current_database\(\) <> 'sinegasi_student_optional_nis_rehearsal'/);
  assert.match(sql, /DISPOSABLE_EMPTY_REHEARSAL_CLUSTER_REQUIRED/);
  assert.equal(sql.split('ALTER TABLE public.students ALTER COLUMN nis DROP NOT NULL;').length - 1, 2);
  for (const check of [
    'MULTIPLE_NULL_STUDENTS_FAILED',
    'DUPLICATE_NIS_ACCEPTED',
    'FAILED_CREATE_NOT_ROLLED_BACK',
    'UNAUTHORIZED_ACTOR_ACCEPTED',
    'FAILED_UPDATE_NOT_ROLLED_BACK',
    'NIS_CLEAR_FAILED',
    'AUDIT_ACTOR_OR_REASON_FAILED',
    'STUDENT_OPTIONAL_NIS_REHEARSAL_OK',
  ]) assert.match(sql, new RegExp(check));
  assert.doesNotMatch(sql, /-- @(?:BASELINE_FUNCTIONS|OPTIONAL_NIS_MIGRATION_TWICE)@/);
});
