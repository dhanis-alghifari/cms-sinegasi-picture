import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('treasurer global dispute read is separate from teacher-only review', async () => {
  const sql = await readFile(path.resolve(__dirname, '079_cash_dispute_read_all.sql'), 'utf8');
  const migrationRunner = await readFile(path.resolve(__dirname, '../scripts/applyCashMigration.ts'), 'utf8');
  assert.match(sql, /VALUES \('cash\.dispute\.read\.all', 'Cash Dispute Read All'\)/);
  assert.match(sql, /VALUES \('treasurer', 'cash\.dispute\.read\.all'\)/);
  assert.match(sql, /role_key = 'treasurer' AND permission_key = 'cash\.dispute\.review'/);
  assert.match(migrationRunner, /'079_cash_dispute_read_all\.sql'/);
});
