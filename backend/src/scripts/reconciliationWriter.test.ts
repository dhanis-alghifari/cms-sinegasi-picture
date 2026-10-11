import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSnapshot, compileReconciliation, sha256 } from './productionReconciliation.js';
import { createWriterPackage, parseWriterOptions, requireWriterQualityRun, validateWriterApproval, validateWriterEvidence, validateWriterRecovery, backupTime } from './reconciliationWriterPolicy.js';
import { runReconciliationWriter } from './reconciliationWriterCore.js';
import { writerFixtureAuthorization } from './reconciliationWriterFixtures.js';
import type { WriterSession } from './reconciliationWriterCatalog.js';
import type { DatabaseInventory } from './productionBackupCore.js';

const repository = resolve(__dirname, '../../..'), now = Date.parse('2026-10-11T09:00:00Z');
async function fixture() {
  const bundle = createWriterPackage(await loadSnapshot(repository));
  const inventory: DatabaseInventory = { tables: bundle.snapshot.legacyTables.map(t => ({ schema: 'public', name: t.relname, rows: '0', rls: t.relrowsecurity, forceRls: false })),
    structure: bundle.snapshot.legacyTables.flatMap(t => t.columns.map(c => ({ kind: 'column', name: t.relname + '.' + c.name,
      definition: JSON.stringify({ type: c.type, notNull: c.notNull, default: c.default, identity: c.identity, generated: '' }) }))), roles: [], extensions: [] };
  const auth = writerFixtureAuthorization(bundle, inventory, 'c'.repeat(64), now);
  return { bundle, auth };
}
test('production compiler is deterministic and does not change rehearsal SQL or its guard', async () => {
  const { bundle } = await fixture();
  assert.deepEqual(bundle, createWriterPackage(bundle.snapshot));
  for (const sql of bundle.sql) assert.match(sql, /PRODUCTION_DATABASE_IDENTITY_REQUIRED/);
  for (const sql of compileReconciliation(bundle.snapshot)) assert.match(sql, /ISOLATED_REHEARSAL_DATABASE_REQUIRED/);
  assert.equal(bundle.reference.tables.reduce((sum, t) => sum + t.rows.length, 0), 213);
});
test('unsafe CLI targets, env URLs, force/reset and implicit apply are refused', () => {
  assert.deepEqual(parseWriterOptions(['plan']), { mode: 'plan' });
  assert.equal(parseWriterOptions(['apply', '--approval', '/private/approval.json', '--confirm-approval', 'a'.repeat(64)]).mode, 'apply');
  for (const args of [[], ['apply'], ['reset'], ['apply', '--force'], ['plan', '--db-url', 'postgres://x'], ['apply', '--approval', 'relative', '--confirm-approval', 'a'.repeat(64)]]) assert.throws(() => parseWriterOptions(args));
});
test('approval requires exact target, release, package, human review, risk and window bindings', async () => {
  const { bundle, auth } = await fixture(), approval = JSON.parse(auth.approvalRaw) as Record<string, unknown>;
  assert.equal(validateWriterApproval(approval, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now).approved, true);
  for (const change of [{ project: 'cdvcwwcpjgmjvpdnytmz' }, { approved: false }, { releaseSha: '2'.repeat(40) },
    { packageSha256: '0'.repeat(64) }, { evidenceSha256: '0'.repeat(64) }, { reviewedBy: '' }, { qualityChecksPassed: false },
    { maintenanceWindowConfirmed: false }, { enumCommitIsNotAtomicWithSchemaAcknowledged: false }, { windowEnd: new Date(now - 1).toISOString() },
    { windowStart: new Date(now + 1).toISOString() }, { windowEnd: new Date(now + 61 * 60_000).toISOString() }]) {
    assert.throws(() => validateWriterApproval({ ...approval, ...change }, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now));
  }
});
test('fresh backup and strict UTC backup ID are mandatory', async () => {
  const { bundle, auth } = await fixture(), approval = JSON.parse(auth.approvalRaw) as Record<string, unknown>;
  for (const backupId of ['ID_BACKUP_BARU', '2026-02-30T09-00-00-000Z', '2026-10-11T06-00-00-000Z', '2026-10-11T10-00-00-000Z']) {
    assert.throws(() => validateWriterApproval({ ...approval, backupId }, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now));
  }
  assert.throws(() => backupTime('../anything'));
});
test('CI must be successful backend/frontend quality on the exact pushed main SHA, not DEV CI', () => {
  const release = '1'.repeat(40);
  const run = { head_sha: release, head_branch: 'main', path: '.github/workflows/quality.yml', status: 'completed', conclusion: 'success', event: 'push' };
  const jobs = { jobs: ['backend-quality', 'frontend-quality'].map(name => ({ name, status: 'completed', conclusion: 'success' })) };
  requireWriterQualityRun(run, jobs, release);
  for (const change of [{ head_branch: 'develop' }, { head_sha: '2'.repeat(40) }, { conclusion: 'failure' }, { event: 'pull_request' }, { path: '.github/workflows/deploy-dev.yml' }]) {
    assert.throws(() => requireWriterQualityRun({ ...run, ...change }, jobs, release));
  }
  assert.throws(() => requireWriterQualityRun(run, { jobs: [jobs.jobs[0]] }, release));
});
test('writer evidence cannot be promoted to a managed test/production approval', async () => {
  const { bundle, auth } = await fixture(), evidence = JSON.parse(auth.evidenceRaw) as Record<string, unknown>;
  validateWriterEvidence(evidence, bundle);
  for (const change of [{ cleanupVerified: false }, { productionApproved: true }, { managedSupabaseIntegrationTested: true }, { checks: {} }, { packageSha256: '0'.repeat(64) }]) {
    assert.throws(() => validateWriterEvidence({ ...evidence, ...change }, bundle));
  }
});
test('ciphertext copy is not independent key recovery; malformed receipts fail closed', async () => {
  const { bundle, auth } = await fixture();
  const approval = validateWriterApproval(JSON.parse(auth.approvalRaw) as unknown, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now);
  const recovery = JSON.parse(auth.recoveryRaw) as Record<string, unknown>;
  validateWriterRecovery(recovery, approval, now);
  for (const mutate of [
    (r: Record<string, unknown>) => { r.independentKeyRecovery = {}; },
    (r: Record<string, unknown>) => { (r.independentKeyRecovery as Record<string, unknown>).sameHostAsApplication = true; },
    (r: Record<string, unknown>) => { (r.copy as Record<string, unknown>).decryptionKeyTransferred = true; },
    (r: Record<string, unknown>) => { (r.copy as Record<string, unknown>).verifiedAt = 'invalid'; },
    (r: Record<string, unknown>) => { (r.copy as Record<string, unknown>).files = []; },
    (r: Record<string, unknown>) => { (r.restore as Record<string, unknown>).archiveSha256 = '0'.repeat(64); },
  ]) { const changed = structuredClone(recovery); mutate(changed); assert.throws(() => validateWriterRecovery(changed, approval, now)); }
});
test('checksum and package tampering cause zero DB queries', async () => {
  const { bundle, auth } = await fixture(); let queries = 0;
  const db: WriterSession = { query: async () => { queries++; throw new Error('never called'); }, inventory: async () => { throw new Error('never called'); } };
  await assert.rejects(runReconciliationWriter(db, bundle, { ...auth, confirmedApprovalSha256: '0'.repeat(64) }, () => now), /APPROVAL_CHECKSUM_MISMATCH/);
  await assert.rejects(runReconciliationWriter(db, { ...bundle, sql: [bundle.sql[0] + 'SELECT 1', bundle.sql[1]] }, auth, () => now), /WRITER_PACKAGE_TAMPERED/);
  await assert.rejects(runReconciliationWriter(db, bundle, { ...auth, recoveryRaw: auth.recoveryRaw + ' ' }, () => now), /RECOVERY_EVIDENCE_CHECKSUM_MISMATCH/);
  assert.equal(queries, 0);
});
test('failure diagnostics are generic and rollback failures become unknown, never false safety', async () => {
  const { bundle, auth } = await fixture();
  const secret = 'PRIVATE-URL-WITH-SECRET';
  const db: WriterSession = { query: async sql => {
    if (sql.startsWith('BEGIN')) return { rows: [] };
    throw new Error(secret);
  }, inventory: async () => auth.backupInventory };
  await assert.rejects(runReconciliationWriter(db, bundle, auth, () => now), (e: unknown) => {
    assert.ok(e instanceof Error && 'mutation' in e); assert.equal(e.mutation, 'unknown');
    assert.ok(!e.message.includes(secret)); return true;
  });
});
test('failed advisory-lock release is reported explicitly, even before any writes', async () => {
  const { bundle, auth } = await fixture();
  const db: WriterSession = { query: async sql => {
    if (sql.includes('pg_backend_pid()')) return { rows: [{ database: 'postgres', actor: 'postgres', pid: 1, version: '170011', readOnly: 'off' }] };
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
    if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: false }] };
    return { rows: [] };
  }, inventory: async () => { throw new Error('fixture inventory failure'); } };
  await assert.rejects(runReconciliationWriter(db, bundle, auth, () => now), (error: unknown) => {
    assert.ok(error instanceof Error && 'mutation' in error); assert.equal(error.mutation, 'none');
    assert.match(error.message, /LOCK_RELEASE_UNCERTAIN/); return true;
  });
});
test('CLI has no runtime env imports, arbitrary endpoint or TLS bypass, and release check precedes secret access', async () => {
  const source = await readFile(resolve(__dirname, 'reconciliationWriter.ts'), 'utf8');
  assert.doesNotMatch(source, /from ['"][^'"]*(?:dotenv|config\/env)|rejectUnauthorized: false|process\.env|--force|allowLocal/);
  assert.match(source, /CLEAN_REVIEWED_CURRENT_MAIN_RELEASE_REQUIRED/);
  assert.match(source, /WRITER_SOURCE_OR_REHEARSAL_EVIDENCE_CHANGED/);
  assert.ok(source.indexOf('await releaseSha(repository') < source.indexOf("readKeychain('sinegasi-prod-postgres-admin-url'"));
});
