import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('contest update migration exposes one auditable atomic RPC', async () => {
  const sql = await readFile(path.resolve(__dirname, '051_contest_update_atomic.sql'), 'utf8');
  for (const token of [
    'CREATE OR REPLACE FUNCTION public.update_contest_atomic',
    "set_config('app.current_user_id'",
    "set_config('app.change_reason'",
    "set_config('app.skip_legacy_audit'",
    'FOR UPDATE',
    'public.write_audit_log',
    'CONTEST_UPDATE_REASON_INVALID',
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), `migration is missing: ${token}`);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\.contests/i);
});
