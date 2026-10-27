import assert from 'node:assert/strict';
import test from 'node:test';
import { requireApprovedBackupRole, withoutApprovedBackupRole } from './productionBackupRolePolicy.js';
import { backupRoleFixture, backupMembershipFixture, backupSecurityFixture } from './productionBackupRoleFixtures.js';
import type { WriterSession } from './reconciliationWriterCatalog.js';

function fixture(role = backupRoleFixture(), memberships = backupMembershipFixture(), settings = 0): WriterSession {
  return { inventory: async () => ({ tables: [], structure: [], extensions: [], roles: [] }),
    async query(sql, values) {
      assert.match(sql, /^SELECT/); assert.deepEqual(values, ['sinegasi_backup']);
      if (sql.includes('rolvaliduntil')) return { rows: [role] };
      if (sql.includes('pg_auth_members')) return { rows: memberships };
      if (sql.includes('pg_db_role_setting')) return { rows: [{ count: settings }] };
      throw new Error('UNEXPECTED_TEST_QUERY');
    } };
}
test('reviewed role metadata and both grantors/memberships are exact; every widening fails closed', async () => {
  await requireApprovedBackupRole(fixture());
  const original = backupRoleFixture();
  for (const [key, value] of Object.entries(original)) {
    const altered = typeof value === 'boolean' ? !value : key === 'rolconnlimit' ? -1 : key === 'rolconfig' ? [] : 'other';
    await assert.rejects(requireApprovedBackupRole(fixture({ ...original, [key]: altered })));
  }
  const memberships = backupMembershipFixture();
  for (const index of [0, 1]) for (const [key, value] of Object.entries(memberships[index])) {
    const changed = memberships.map((row, i) => i === index ? { ...row, [key]: typeof value === 'boolean' ? !value : 'other' } : row);
    await assert.rejects(requireApprovedBackupRole(fixture(original, changed)));
  }
  for (const rows of [[], memberships.slice(0, 1), [...memberships, memberships[0]],
    [memberships[0], memberships[0]], [{ ...memberships[0], extra: true }, memberships[1]]]) {
    await assert.rejects(requireApprovedBackupRole(fixture(original, rows)));
  }
  await assert.rejects(requireApprovedBackupRole(fixture(original, memberships, 1)));
});
test('only one reviewed role and two exact security entries are removed from checkpoint comparison', () => {
  const other = { kind: 'membership', name: 'unrelated:postgres', metadata: '{}' };
  const role = { name: 'sinegasi_backup', inherit: true, bypassRls: true };
  const inventory = { tables: [], structure: [], extensions: [], roles: [role, { ...role, name: 'unrelated' }] };
  const security = [...backupSecurityFixture(), other];
  const result = withoutApprovedBackupRole({ inventory, security });
  assert.deepEqual(result.inventory.roles, [inventory.roles[1]]); assert.deepEqual(result.security, [other]);
  assert.equal(inventory.roles.length, 2); assert.equal(security.length, 3);
  for (const rows of [[], security.slice(0, 1), [...security, security[0]],
    [...security, { ...other, name: 'sinegasi_backup:anon' }],
    [{ ...security[0], metadata: '{"admin":false,"inherit":true,"set":true,"extra":true}' }, ...security.slice(1)]]) {
    assert.throws(() => withoutApprovedBackupRole({ inventory, security: rows }));
  }
});
