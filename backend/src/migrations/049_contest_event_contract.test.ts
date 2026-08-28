import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest event contract migration is additive and enforces future deadlines', async () => {
  const sql = await readFile(path.resolve(__dirname, '049_contest_event_contract.sql'), 'utf8');
  for (const token of [
    'ADD COLUMN IF NOT EXISTS kota TEXT',
    'ADD COLUMN IF NOT EXISTS tahun_event INTEGER',
    "set_config('app.system_operation', 'true', true)",
    "'SYSTEM:MIGRATION_049_BACKFILL_EVENT_YEAR'",
    'uq_contest_name_event_year',
    'validate_contest_deadline_future',
    'CONTEST_DEADLINE_MUST_BE_FUTURE',
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), `migration is missing: ${token}`);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\.contests/i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+(kota|tahun_event)/i);
});
