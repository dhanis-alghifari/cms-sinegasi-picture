import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('077 purges inactive student history without changing real cashflow', async () => {
  const sql = await readFile(path.resolve(__dirname, '077_student_history_purge.sql'), 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.purge_student_history_atomic/);
  assert.match(sql, /rp\.permission_key = 'users\.manage'/);
  assert.match(sql, /v_student\.is_active IS TRUE/);
  assert.match(sql, /DELETE FROM public\.debt_records WHERE student_id = p_student_id/);
  assert.match(sql, /COALESCE\(is_billing, FALSE\) IS TRUE/);
  assert.match(sql, /SET student_id = NULL/);
  assert.match(sql, /preserved_cash_transactions/);
  assert.match(sql, /DELETE FROM public\.equipment_charge_settlements/);
  assert.match(sql, /STUDENT_PURGE_ACCOUNT_HISTORY_BLOCKED|activity_logs bersifat immutable/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.purge_student_history_atomic[\s\S]+TO service_role/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});
