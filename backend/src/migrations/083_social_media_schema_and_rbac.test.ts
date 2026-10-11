import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('social migration rewrites old clauses and accepts clauses already updated with the social role', async () => {
  const migration = await readFile(path.resolve(__dirname, '083_social_media_schema_and_rbac.sql'), 'utf8');
  const allowTreasurer = await readFile(path.resolve(__dirname, '078_allow_student_treasurer_role.sql'), 'utf8');
  const boundaries = await readFile(path.resolve(__dirname, '076_student_account_boundaries.sql'), 'utf8');
  const accountUpdate = await readFile(path.resolve(__dirname, '041_user_account_update_atomic.sql'), 'utf8');

  const currentRoleClauses = [
    `IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')`,
    `NEW.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')`,
    `OLD.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')`,
    `u.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')`,
    `v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')`,
    `'equipment_team', 'contest_team', 'member'`,
  ];
  for (const clause of currentRoleClauses) assert.ok(migration.includes(clause), `migration 083 must match current clause: ${clause}`);

  assert.ok(allowTreasurer.includes(currentRoleClauses[0]!));
  assert.ok(allowTreasurer.includes(currentRoleClauses[1]!));
  assert.ok(allowTreasurer.includes(currentRoleClauses[3]!));
  assert.ok(allowTreasurer.includes(currentRoleClauses[4]!));
  assert.ok(boundaries.includes(currentRoleClauses[2]!));
  assert.ok(accountUpdate.includes(currentRoleClauses[5]!));
  assert.match(migration, /SOCIAL_STUDENT_ROLE_EXPECTED_ONE_CHECK/);
  assert.match(migration, /v_occurrences = 1 AND v_new_occurrences = 0/);
  assert.match(migration, /v_occurrences = 0 AND v_new_occurrences = 1/);
  assert.match(migration, /v_new_occurrences <> 1 OR v_occurrences <> 0/);
  assert.match(migration, /SOCIAL_STUDENT_ROLE_SECURITY_CHANGED/);
});
