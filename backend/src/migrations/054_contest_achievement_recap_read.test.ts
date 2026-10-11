import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest achievement recap migration groups completed entries and protects read RPCs', async () => {
  const sql = await readFile(path.resolve(__dirname, '054_contest_achievement_recap_read.sql'), 'utf8');

  for (const token of [
    "CREATE INDEX IF NOT EXISTS idx_contest_entries_completed_recap",
    "CREATE INDEX IF NOT EXISTS idx_contest_entry_results_active_entry_filter",
    'list_contest_achievements_grouped',
    'get_contest_achievement_detail',
    "WHERE e.pipeline_status = 'selesai'",
    "'awards'",
    "'evidence'",
    "'timeline'",
    'REVOKE ALL ON FUNCTION',
    'GRANT EXECUTE ON FUNCTION',
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), `migration is missing: ${token}`);

  assert.match(sql, /count\(\*\) OVER \(\)/);
  assert.match(sql, /jsonb_agg\([\s\S]+ORDER BY r\.created_at, r\.id/);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+/i);
});
