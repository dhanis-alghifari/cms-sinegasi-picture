import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('request capability migration separates borrowing submission from management', async () => {
  const sql = await readFile(path.resolve(__dirname, '069_borrowing_request_capability.sql'), 'utf8');

  for (const token of [
    "('borrowing.request', 'Ajukan peminjaman alat')",
    "'teacher', 'leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team'",
    "('borrowing.read'), ('borrowing.return.report')",
    "AND permission_key = 'borrowing.manage'",
    "migration_name = '068_borrowing_self_return_verification.sql'",
    "'069_borrowing_request_capability.sql'",
  ]) {
    assert.ok(sql.includes(token), `migration is missing: ${token}`);
  }
});
