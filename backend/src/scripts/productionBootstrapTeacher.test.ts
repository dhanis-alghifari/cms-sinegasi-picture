import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { bootstrapApprovedProductionTeacher, requireCompletedBootstrapCheckpoint, validateProductionBootstrapApproval,
  validateBootstrapEvidence } from './productionBootstrapTeacherCore.js';
import { mainBootstrapTeacher } from './bootstrapTeacher.js';
import { bootstrapFixtureAuthorization } from './productionBootstrapTeacherFixtures.js';
import { createWriterPackage } from './reconciliationWriterPolicy.js';
import { loadSnapshot, sha256 } from './productionReconciliation.js';
import type { WriterSession, WriterCatalog } from './reconciliationWriterCatalog.js';
import { parseProductionBootstrapCommand } from './productionBootstrapTeacher.js';
import { verifiedBackupInventory } from './reconciliationWriter.js';

const now = Date.parse('2026-10-11T17:00:00Z');
test('shared backup verifier refuses invalid IDs before filesystem, SSH or Keychain', async () => {
  for (const id of ['ID_BACKUP_BARU', '../escape', "2026-10-11T16-00-00-000Z'; echo unsafe", '2026-02-30T16-00-00-000Z']) {
    await assert.rejects(verifiedBackupInventory(id, '{}'), /INVALID_BACKUP_ID/);
  }
});
async function fixture() {
  const bundle = createWriterPackage(await loadSnapshot(resolve(__dirname, '../../..')));
  const catalog: WriterCatalog = { security: [], inventory: { tables: [], structure: [], extensions: [], roles: [] } };
  const auth = bootstrapFixtureAuthorization(bundle, catalog, 'e'.repeat(64), 'f'.repeat(64), now);
  const approval = JSON.parse(auth.approvalRaw) as Record<string, unknown>;
  return { bundle, auth, approval };
}
test('production bootstrap CLI defaults to explicit offline plan and requires readiness before Keychain', () => {
  assert.deepEqual(parseProductionBootstrapCommand(['plan']), { mode: 'plan' });
  assert.deepEqual(parseProductionBootstrapCommand(['inspect', '--keychain-ready']), { mode: 'inspect' });
  assert.equal(parseProductionBootstrapCommand(['apply', '--approval', '/private/approval.json', '--confirm-approval', 'a'.repeat(64), '--keychain-ready']).mode, 'apply');
  for (const args of [[], ['inspect'], ['apply'], ['apply', '--force'], ['plan', '--password', 'confidential'],
    ['apply', '--approval', 'relative', '--confirm-approval', 'a'.repeat(64), '--keychain-ready']]) assert.throws(() => parseProductionBootstrapCommand(args));
});
test('legacy remote apply is blocked before connection, Keychain or credentials', async () => {
  await assert.rejects(mainBootstrapTeacher(['--project-ref', 'pvbdiftvzoeelibxlxzb', '--username', 'fixture.teacher',
    '--name', 'Fixture Teacher', '--apply', '--confirm-project', 'pvbdiftvzoeelibxlxzb', '--credential-file', '/tmp/fixture.json']),
  { code: 'USE_REVIEWED_PRODUCTION_BOOTSTRAP_RUNNER' });
});
test('bootstrap approval binds exact production project, code, account, path and separate authorization', async () => {
  const { bundle, auth, approval } = await fixture();
  assert.equal(validateProductionBootstrapApproval(approval, bundle, auth, now).approved, true);
  for (const change of [{ approved: false }, { operation: 'migrate' }, { project: 'cdvcwwcpjgmjvpdnytmz' },
    { releaseSha: '2'.repeat(40) }, { runnerSourceSha256: '0'.repeat(64) }, { packageSha256: '0'.repeat(64) },
    { isolatedFixture: true }, { username: "admin'; --" }, { nama: 'Bad\nName' }, { credentialFile: 'relative.json' },
    { credentialFile: '/tmp/../tmp/a.json' }, { credentialFile: '/tmp/a.txt' }, { reviewedBy: '' }, { qualityRunId: 0 },
    { maintenanceWindowConfirmed: false }, { noDeploymentAuthorized: false }, { firstTeacherOnlyAcknowledged: false }]) {
    assert.throws(() => validateProductionBootstrapApproval({ ...approval, ...change }, bundle, auth, now));
  }
});
test('expired/future/overlong windows and stale, invalid or future backups refuse approval', async () => {
  const { bundle, auth, approval } = await fixture();
  for (const change of [{ windowEnd: new Date(now).toISOString() }, { windowStart: new Date(now + 1).toISOString() },
    { windowEnd: new Date(now + 60 * 60_000).toISOString() }, { windowStart: 'invalid' },
    { backupId: 'ID_BACKUP_BARU' }, { backupId: '2026-10-11T14-00-00-000Z' }, { backupId: '2026-10-11T18-00-00-000Z' }]) {
    assert.throws(() => validateProductionBootstrapApproval({ ...approval, ...change }, bundle, auth, now));
  }
});
test('managed receipt requires exact clean release; historical dirty evidence cannot authorize an account', async () => {
  const { bundle, auth, approval } = await fixture();
  const a = validateProductionBootstrapApproval(approval, bundle, auth, now);
  const historical = JSON.stringify({ ...JSON.parse(auth.integrationRaw), releaseSha: '2'.repeat(40), workingTreeDirty: true });
  assert.throws(() => validateBootstrapEvidence({ ...auth, integrationRaw: historical }, { ...a, integrationEvidenceSha256: sha256(historical) }, bundle, now));
  validateBootstrapEvidence(auth, a, bundle, now);
  for (const change of [{ releaseSha: '2'.repeat(40) }, { workingTreeDirty: true },
    { sourceSha256: '0'.repeat(64) }, { schemaPackageSha256: '0'.repeat(64) },
    { referenceChecksum: '0'.repeat(64) }, { productionChanged: true }, { workersStarted: true }, { checks: [] },
    { requests: { sent: 232, blocked: 1 } }, { observedAt: new Date(now).toISOString() }, { observedAt: 'invalid' },
    { observedAt: new Date(now - 25 * 60 * 60_000).toISOString() }]) {
    const raw = JSON.stringify({ ...JSON.parse(auth.integrationRaw), ...change });
    assert.throws(() => validateBootstrapEvidence({ ...auth, integrationRaw: raw }, { ...a, integrationEvidenceSha256: sha256(raw) }, bundle, now));
  }
});
test('guard requires isolated real-PostgreSQL receipt, exact source and verified cleanup', async () => {
  const { bundle, auth, approval } = await fixture();
  const a = validateProductionBootstrapApproval(approval, bundle, auth, now);
  for (const change of [{ runnerSourceSha256: '0'.repeat(64) }, { cleanupVerified: false }, { managedSupabaseIntegrationTested: true },
    { productionApproved: true }, { checks: {} }]) {
    const raw = JSON.stringify({ ...JSON.parse(auth.rehearsalRaw), ...change });
    assert.throws(() => validateBootstrapEvidence({ ...auth, rehearsalRaw: raw }, { ...a, rehearsalEvidenceSha256: sha256(raw) }, bundle, now));
  }
});
test('Mac-only custody must remain honest; ciphertext copy is not independent key recovery', async () => {
  const { bundle, auth, approval } = await fixture();
  const a = validateProductionBootstrapApproval(approval, bundle, auth, now);
  const proof = JSON.parse(auth.recoveryRaw) as Record<string, unknown>;
  const raw = JSON.stringify({ ...proof, independentKeyRecovery: { verified: true } });
  assert.throws(() => validateBootstrapEvidence({ ...auth, recoveryRaw: raw }, { ...a, recoveryEvidenceSha256: sha256(raw) }, bundle, now));
  const brokenCopy = JSON.stringify({ ...proof, copy: {} });
  assert.throws(() => validateBootstrapEvidence({ ...auth, recoveryRaw: brokenCopy }, { ...a, recoveryEvidenceSha256: sha256(brokenCopy) }, bundle, now));
});
test('tampered approval/package/evidence performs zero SQL and generates no credentials', async () => {
  const { bundle, auth } = await fixture(); let queries = 0, files = 0;
  const db: WriterSession = { async query() { queries++; throw new Error('unexpected query'); }, async inventory() { throw new Error('unexpected inventory'); } };
  const credentials = { async create() { files++; throw new Error('unexpected credential'); } };
  for (const change of [{ confirmedApprovalSha256: '0'.repeat(64) }, { recoveryRaw: auth.recoveryRaw + ' ' },
    { integrationRaw: auth.integrationRaw + ' ' }, { rehearsalRaw: auth.rehearsalRaw + ' ' }]) {
    await assert.rejects(bootstrapApprovedProductionTeacher(db, credentials, bundle, { ...auth, ...change }, () => now));
  }
  await assert.rejects(bootstrapApprovedProductionTeacher(db, credentials, { ...bundle, sql: [bundle.sql[0] + '; SELECT 1', bundle.sql[1]] }, auth, () => now));
  assert.equal(queries, 0); assert.equal(files, 0);
});
test('only one COMPLETE private checkpoint with exact package and completion checksum is accepted', async () => {
  const { bundle } = await fixture();
  let rows: Array<Record<string, unknown>> = [{ package_sha256: bundle.packageSha256, stage: 'complete',
    target_catalog_sha256: 'e'.repeat(64), approval_sha256: 'f'.repeat(64), completion_authorization: null }];
  const db: WriterSession = { async inventory() { throw new Error('not used'); }, async query(sql) {
    if (sql.includes('AS present')) return { rows: [{ present: true }] };
    if (sql.includes('has_schema_privilege')) return { rows: [{ usage: false, create: false, access: false }] };
    return { rows };
  } };
  assert.equal((await requireCompletedBootstrapCheckpoint(db, bundle)).migrationApprovalSha256, 'f'.repeat(64));
  rows[0].completion_authorization = { approvalSha256: 'a'.repeat(64), releaseSha: '1'.repeat(40), backupInventorySha256: 'b'.repeat(64) };
  assert.equal((await requireCompletedBootstrapCheckpoint(db, bundle)).migrationApprovalSha256, 'a'.repeat(64));
  const complete = structuredClone(rows[0]);
  for (const change of [{ stage: 'enums' }, { package_sha256: '0'.repeat(64) }, { target_catalog_sha256: null },
    { completion_authorization: {} }, { completion_authorization: { ...complete.completion_authorization as object, extra: true } }]) {
    rows = [{ ...complete, ...change }]; await assert.rejects(requireCompletedBootstrapCheckpoint(db, bundle));
  }
  rows = []; await assert.rejects(requireCompletedBootstrapCheckpoint(db, bundle));
  rows = [complete, complete]; await assert.rejects(requireCompletedBootstrapCheckpoint(db, bundle));
});
test('private history grants or missing checkpoint are refused without secrets', async () => {
  const { bundle } = await fixture();
  for (const scenario of ['absent', 'exposed']) {
    const db: WriterSession = { async inventory() { throw new Error('not used'); }, async query(sql) {
      if (sql.includes('AS present')) return { rows: [{ present: scenario !== 'absent' }] };
      return { rows: [{ usage: false, create: false, access: true }] };
    } };
    await assert.rejects(requireCompletedBootstrapCheckpoint(db, bundle));
  }
});
