import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest media migration is additive and contains the generalized entry pipeline', async () => {
  const sql = await readFile(path.resolve(__dirname, '048_contest_media_works.sql'), 'utf8');
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  for (const token of [
    'CREATE TABLE IF NOT EXISTS public.media_works',
    'CREATE TABLE IF NOT EXISTS public.contest_entries',
    'CREATE TABLE IF NOT EXISTS public.contest_entry_evidence',
    'CREATE TABLE IF NOT EXISTS public.contest_entry_status_history',
    'legacy_submission_id UUID',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_media_works_legacy_submission',
    'create_contest_entry_atomic',
    'transition_contest_entry_atomic',
    "INSERT INTO public.contest_migration_history (migration_name)",
    'NOTIFY pgrst',
  ]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(sql, /DROP TABLE\s+public\.(media_works|contest_entries)/i);
  assert.doesNotMatch(sql, /_contest_submission_work_map/i);
  assert.doesNotMatch(sql, /cf\.(created_by|created_at)/i);
  assert.match(
    sql,
    /SELECT cf\.id, cf\.contest_id, cf\.film_id, 'proses_submit', NULL, mw\.created_by, mw\.created_at/,
  );
});
