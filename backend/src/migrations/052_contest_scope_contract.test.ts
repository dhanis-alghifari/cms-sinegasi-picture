import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest scope migration is auditable, idempotent, and protects the canonical values', async () => {
  const sql = await readFile(path.resolve(__dirname, '052_contest_scope_contract.sql'), 'utf8');
  for (const token of [
    "set_config('app.system_operation', 'true'",
    'contest_scope_from_legacy',
    'contest_legacy_level_from_scope',
    'MIGRATION_PREFLIGHT_FAILED',
    'contests_tingkat_scope_check',
    "('bekasi', 'jabodetabek', 'jawa_barat', 'nasional', 'umum')",
    'sync_contest_frontend_contract',
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), `migration is missing: ${token}`);
  assert.ok(
    sql.indexOf('DROP TRIGGER IF EXISTS trg_sync_contest_frontend_contract')
      < sql.indexOf('UPDATE public.contests'),
    'legacy sync trigger must be removed before canonical scope backfill',
  );
  assert.doesNotMatch(sql, /DROP TABLE\s+public\.contests/i);
});
