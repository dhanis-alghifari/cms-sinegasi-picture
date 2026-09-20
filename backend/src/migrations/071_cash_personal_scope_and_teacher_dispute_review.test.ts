import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('cash scope migration grants personal access and protects teacher-only review', async () => {
  const sql = await readFile(path.resolve(__dirname, '071_cash_personal_scope_and_teacher_dispute_review.sql'), 'utf8');
  const migrationRunner = await readFile(path.resolve(__dirname, '../scripts/applyCashMigration.ts'), 'utf8');
  for (const token of [
    "('cash.read.own', 'Cash Read Own')",
    "('cash.dispute.create', 'Cash Dispute Create')",
    "role_key IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')",
    "VALUES ('teacher', 'cash.dispute.review')",
    "role_key = 'treasurer' AND permission_key = 'cash.dispute.review'",
    'guard_cash_dispute_actor',
    'guard_cash_dispute_reviewer',
    "role::TEXT = 'teacher'",
    "u.role::TEXT = 'teacher'",
    "'SYSTEM:MIGRATION_071_CASH_PERSONAL_SCOPE'",
  ]) {
    assert.ok(sql.includes(token), `migration is missing: ${token}`);
  }
  assert.match(sql, /CREATE TRIGGER trg_guard_cash_dispute_actor/);
  assert.match(sql, /CREATE TRIGGER trg_guard_cash_dispute_reviewer/);
  assert.doesNotMatch(sql, /role::TEXT IN \('teacher', 'treasurer'\)/);
  assert.match(migrationRunner, /'071_cash_personal_scope_and_teacher_dispute_review\.sql'/);
});
