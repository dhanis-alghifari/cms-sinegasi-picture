import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('borrowing return evidence migration keeps uploads private and conditionally required', async () => {
  const sql = await readFile(path.resolve(__dirname, '062_borrowing_return_evidence.sql'), 'utf8');

  for (const token of [
    'CREATE TABLE IF NOT EXISTS public.borrowing_return_evidence',
    'ALTER TABLE public.borrowing_return_evidence ENABLE ROW LEVEL SECURITY',
    'reserve_borrowing_return_evidence_atomic',
    'RETURN_EVIDENCE_FILE_INVALID',
    'RETURN_EVIDENCE_REQUIRED',
    "upload_status = 'attached'",
    'NOTIFY pgrst',
  ]) assert.ok(sql.includes(token), `migration is missing: ${token}`);

  assert.match(sql, /file_size_bytes BETWEEN 1 AND 614400/);
  assert.match(sql, /v_condition <> 'hilang' AND cardinality\(v_evidence_ids\) < 2/);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+/i);
});
