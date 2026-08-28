import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest results migration keeps legacy fields and adds atomic multi-result flow', async () => {
  const sql = await readFile(path.resolve(__dirname, '050_contest_entry_results.sql'), 'utf8');
  for (const token of [
    'ADD COLUMN IF NOT EXISTS outcome_status TEXT',
    'CREATE TABLE IF NOT EXISTS public.contest_entry_results',
    'CREATE TABLE IF NOT EXISTS public.contest_entry_result_history',
    'CREATE TABLE IF NOT EXISTS public.contest_entry_result_operations',
    'record_contest_entry_result_atomic',
    'list_contest_achievements',
    'CONTEST_RESULT_IDEMPOTENCY_REUSED',
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), `migration is missing: ${token}`);
  assert.match(sql, /result_kind IN \(\s*'rank',\s*'top_n'/s);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\.(contest_entries|contest_entry_results)/i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+(result_label|result_note)/i);
});
