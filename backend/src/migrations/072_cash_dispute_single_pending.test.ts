import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('single pending dispute migration serializes student submissions', async () => {
  const sql = await readFile(path.resolve(__dirname, '072_cash_dispute_single_pending.sql'), 'utf8');
  assert.match(sql, /idx_cash_disputes_student_pending/);
  assert.match(sql, /student_id = p_student_id\s+AND status = 'pending'/);
  assert.match(sql, /MESSAGE = 'DISPUTE_PENDING'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /SET search_path = public, pg_temp/);
  assert.match(sql, /SYSTEM:MIGRATION_072_CASH_DISPUTE_SINGLE_PENDING/);
});
