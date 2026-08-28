import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest pipeline evidence migration is additive, strict, and atomic', async () => {
  const sql = await readFile(
    path.resolve(__dirname, '053_contest_pipeline_evidence_contract.sql'),
    'utf8',
  );

  for (const token of [
    "set_config('app.system_operation', 'true'",
    'ALTER COLUMN public_url DROP NOT NULL',
    'CREATE TABLE IF NOT EXISTS public.contest_entry_pipeline_operations',
    'MIGRATION_PREFLIGHT_FAILED',
    'reserve_contest_entry_evidence_atomic',
    'transition_contest_entry_pipeline_atomic',
    'finalize_contest_entry_atomic',
    "('rank', 'finalist', 'nominee', 'other')",
    'public.write_audit_log',
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), `migration is missing: ${token}`);

  assert.match(sql, /v_current\.pipeline_status <> 'menunggu_pengumuman'/);
  assert.match(sql, /p_status = 'sudah_terkirim'[\s\S]+p_evidence_id IS NULL/);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+/i);
});
