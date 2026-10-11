import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('073 scopes pending protection to the exact transaction or debt target', async () => {
  const sql = await readFile(path.resolve(__dirname, '073_cash_dispute_per_target_pending.sql'), 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_cash_dispute_atomic/);
  assert.match(sql, /active-target check is intentionally scoped to this exact target/);
  assert.match(sql, /transaction_id = p_transaction_id/);
  assert.match(sql, /debt_record_id = p_debt_record_id/);
  assert.match(sql, /status IN \('pending', 'approved'\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.doesNotMatch(sql, /A student resolves one dispute at a time across both transactions and debts/);
  assert.doesNotMatch(sql, /WHERE student_id = p_student_id\s+AND status = 'pending'/);
});
