import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest reconciliation migration is transactional, idempotent, and refreshes PostgREST', async () => {
  const sql = await readFile(path.resolve(__dirname, '047_contest_schema_reconciliation.sql'), 'utf8');

  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS nama_lomba TEXT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS deadline DATE/);
  assert.match(sql, /nama_festival = COALESCE/);
  assert.match(sql, /tanggal_lomba = COALESCE/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.sync_contest_frontend_contract/);
  assert.match(sql, /DROP TRIGGER IF EXISTS trg_sync_contest_frontend_contract/);
  assert.match(sql, /ON CONFLICT \(migration_name\) DO NOTHING/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});
