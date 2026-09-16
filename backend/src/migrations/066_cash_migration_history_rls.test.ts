import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const sql = readFileSync(path.resolve(__dirname, '066_cash_migration_history_rls.sql'), 'utf8');

test('cash migration bookkeeping is private and RLS protected', () => {
  assert.match(sql, /ALTER TABLE public\.cash_migration_history ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.cash_migration_history FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /NOTIFY pgrst/i);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
});
