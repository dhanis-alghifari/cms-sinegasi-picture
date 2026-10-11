import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('self-return migration keeps the report flow private and atomic', async () => {
  const sql = await readFile(path.resolve(__dirname, '068_borrowing_self_return_verification.sql'), 'utf8');

  for (const token of [
    "status IN ('pending', 'approved', 'rejected', 'borrowed', 'returned', 'partial', 'pending_verification')",
    'CREATE TABLE IF NOT EXISTS public.borrowing_return_reports',
    'CREATE TABLE IF NOT EXISTS public.borrowing_return_operations',
    'reserve_borrowing_self_return_evidence_atomic',
    'submit_borrowing_self_return_atomic',
    'verify_borrowing_self_return_atomic',
    'RETURN_REPORT_EVIDENCE_ITEM_REQUIRED',
    "role::TEXT = 'teacher'",
    'REVOKE ALL ON FUNCTION public.verify_borrowing_self_return_atomic',
    "GRANT EXECUTE ON FUNCTION public.verify_borrowing_self_return_atomic",
  ]) {
    assert.ok(sql.includes(token), `migration is missing: ${token}`);
  }

  assert.ok(!sql.includes('GRANT EXECUTE ON FUNCTION public.verify_borrowing_self_return_atomic(UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, TEXT) TO PUBLIC'));
});
