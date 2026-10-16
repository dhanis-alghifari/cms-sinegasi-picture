import assert from 'node:assert/strict';
import test from 'node:test';
import childProcess, { type SpawnOptions } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSnapshot, compileReconciliation, sha256 } from './productionReconciliation.js';
import { createWriterPackage, parseWriterOptions, requireWriterQualityRun, validateWriterApproval, validateWriterEvidence, validateWriterRecovery, validateResumeApproval, backupTime } from './reconciliationWriterPolicy.js';
import { runReconciliationWriter } from './reconciliationWriterCore.js';
import { writerFixtureAuthorization, writerMacOnlyFixture, writerResumeFixture } from './reconciliationWriterFixtures.js';
import { validateManagedTrigram } from './reconciliationWriterExtensions.js';
import type { WriterSession } from './reconciliationWriterCatalog.js';
import type { DatabaseInventory } from './productionBackupCore.js';
import { requireWriterReleaseSha } from './reconciliationWriter.js';

const repository = resolve(__dirname, '../../..'), now = Date.parse('2026-10-11T09:00:00Z');
test('release gate keeps clean main, exact origin and current remote SHA checks before approval/database access', async (t) => {
  const sha = 'a'.repeat(40), spawn = childProcess.spawn;
  let remoteCalls = 0;
  let scenario: { dirty?: boolean; branch?: string; origin?: string; head?: string; remote?: string; remoteFailed?: boolean } = {};
  t.mock.method(childProcess, 'spawn', (_command: string, args: string[], options: SpawnOptions) => {
    const command = args.slice(2).join(' ');
    let output: string;
    if (command === 'rev-parse HEAD') output = scenario.head ?? sha;
    else if (command === 'status --porcelain') output = scenario.dirty ? ' M unsafe.ts' : '';
    else if (command === 'symbolic-ref --short HEAD') output = scenario.branch ?? 'main';
    else if (command === 'remote get-url origin') output = scenario.origin ?? 'https://github.com/dhanis-alghifari/cms-sinegasi-picture.git';
    else if (args.includes('ls-remote')) {
      remoteCalls++;
      if (scenario.remoteFailed) return spawn(process.execPath, ['-e', 'process.exit(128)'], options);
      output = (scenario.remote ?? sha) + '\trefs/heads/main';
    } else throw new Error('unexpected command');
    return spawn(process.execPath, ['-e', `process.stdout.write(${JSON.stringify(output + (output ? '\n' : ''))})`], options);
  });
  assert.equal(await requireWriterReleaseSha(repository, true), sha);
  assert.equal(remoteCalls, 1);
  for (const invalid of [{ dirty: true }, { branch: 'develop' }, { origin: 'https://evil.invalid/repo.git' },
    { origin: 'https://synthetic-token@github.com/dhanis-alghifari/cms-sinegasi-picture.git' }]) {
    scenario = invalid;
    await assert.rejects(requireWriterReleaseSha(repository, true), /CLEAN_REVIEWED_CURRENT_MAIN_RELEASE_REQUIRED/);
    assert.equal(remoteCalls, 1);
  }
  scenario = { remote: 'b'.repeat(40) };
  await assert.rejects(requireWriterReleaseSha(repository, true), /CLEAN_REVIEWED_CURRENT_MAIN_RELEASE_REQUIRED/);
  scenario = { remoteFailed: true };
  await assert.rejects(requireWriterReleaseSha(repository, true), /GITHUB_MAIN_METADATA_UNAVAILABLE/);
  scenario = { head: 'synthetic-secret' };
  await assert.rejects(requireWriterReleaseSha(repository, true), /INVALID_RELEASE_SHA/);
  scenario = { dirty: true, branch: 'develop' };
  const before = remoteCalls;
  assert.equal(await requireWriterReleaseSha(repository, false), sha);
  assert.equal(remoteCalls, before);
});

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
  assert.equal(parseWriterOptions(['resume', '--approval', '/private/approval.json', '--confirm-approval', 'a'.repeat(64)]).mode, 'resume');
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
test('Mac-only initialization needs explicit bounded risk acceptance and honest key custody', async () => {
  const { bundle, auth: independent } = await fixture(), auth = writerMacOnlyFixture(independent);
  const rawApproval = JSON.parse(auth.approvalRaw) as Record<string, unknown>;
  const approval = validateWriterApproval(rawApproval, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now);
  const recovery = JSON.parse(auth.recoveryRaw) as Record<string, unknown>;
  validateWriterRecovery(recovery, approval, now);
  for (const change of [{ recoveryMode: 'force' }, { recoveryMode: null }, { recoveryMode: 'independent-key' },
    { macOnlyRecoveryRiskAcknowledged: false }, { initialEmptyProductionOnly: false },
    { macOnlyRecoveryRiskAcknowledged: undefined }, { initialEmptyProductionOnly: undefined }]) {
    assert.throws(() => validateWriterApproval({ ...rawApproval, ...change }, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now));
  }
  for (const change of [{ verified: true }, { sameDeviceAsMac: false }, { sameHostAsApplication: true }, { medium: 'VPS private key' }]) {
    assert.throws(() => validateWriterRecovery({ ...recovery,
      independentKeyRecovery: { ...(recovery.independentKeyRecovery as Record<string, unknown>), ...change } }, approval, now));
  }
  const defaultApproval = validateWriterApproval(JSON.parse(independent.approvalRaw) as unknown, bundle,
    independent.releaseSha, sha256(independent.evidenceRaw), now);
  assert.throws(() => validateWriterRecovery(recovery, defaultApproval, now));
  for (const key of ['receipt', 'restore', 'copy']) assert.throws(() => validateWriterRecovery({ ...recovery, [key]: {} }, approval, now));
});
test('Mac-only mode cannot bypass fresh backups, writer evidence or nonempty public backup checks', async () => {
  const { bundle, auth: independent } = await fixture(), auth = writerMacOnlyFixture(independent);
  const approval = JSON.parse(auth.approvalRaw) as Record<string, unknown>;
  assert.throws(() => validateWriterApproval({ ...approval, backupId: '2026-10-11T06-00-00-000Z' }, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now));
  const evidence = JSON.parse(auth.evidenceRaw) as Record<string, unknown>;
  assert.throws(() => validateWriterEvidence({ ...evidence, checks: { ...(evidence.checks as Record<string, unknown>), macOnlyInitialization: false } }, bundle));
  let queries = 0;
  const db: WriterSession = { query: async () => { queries++; throw new Error('never called'); }, inventory: async () => auth.backupInventory };
  const backupInventory = structuredClone(auth.backupInventory); backupInventory.tables[0].rows = '1';
  await assert.rejects(runReconciliationWriter(db, bundle, { ...auth, backupInventory }, () => now));
  assert.equal(queries, 0);
});
test('Mac-only mode rejects missing or nonempty managed-data counters before any DDL', async () => {
  const { bundle, auth: independent } = await fixture(), auth = writerMacOnlyFixture(independent);
  for (const counts of [undefined, { authAccounts: '1', storageObjects: '0' }, { authAccounts: '0', storageObjects: '1' },
    { authAccounts: '0' }, { authAccounts: 0, storageObjects: 0 }]) {
    const queries: string[] = [];
    const db: WriterSession = { query: async sql => {
      queries.push(sql);
      if (sql.includes('pg_backend_pid()')) return { rows: [{ database: 'postgres', actor: 'postgres', pid: 1, version: '170011', readOnly: 'off' }] };
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
      if (sql.includes("to_regnamespace('sinegasi_ops')")) return { rows: [{ schema: false, history: false }] };
      if (sql.includes('AS "authAccounts"')) return { rows: counts ? [counts] : [] };
      return { rows: [] };
    }, inventory: async () => auth.backupInventory };
    await assert.rejects(runReconciliationWriter(db, bundle, auth, () => now), /MAC_ONLY_INITIALIZATION_REQUIRES_EMPTY_AUTH_AND_STORAGE/);
    assert.ok(queries.includes('LOCK TABLE auth.users, storage.objects IN SHARE MODE'));
    const firstSelect = queries.findIndex(sql => sql.trim().startsWith('SELECT'));
    assert.ok(queries.indexOf('LOCK TABLE auth.users, storage.objects IN SHARE MODE') < firstSelect);
    assert.ok(queries.findIndex(sql => sql.startsWith('LOCK TABLE public.')) < firstSelect);
    assert.ok(queries.includes('ROLLBACK'));
    assert.ok(queries.every(sql => !/^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|GRANT|REVOKE)\b/i.test(sql)));
  }
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
  const releaseGate = source.indexOf('await requireWriterReleaseSha(repository');
  const adminAccess = source.indexOf("readKeychain('sinegasi-prod-postgres-admin-url'");
  assert.ok(releaseGate >= 0 && adminAccess > releaseGate);
});

test('resume binds the original document, exact enum checkpoint, new release and new backup before DB access', async () => {
  const { bundle, auth } = await fixture();
  const resumed = writerResumeFixture(bundle, auth, auth.backupInventory, 'd'.repeat(64), sha256('[]'), now + 60_000);
  const approval = validateWriterApproval(JSON.parse(resumed.approvalRaw) as unknown, bundle, resumed.releaseSha, sha256(resumed.evidenceRaw), now + 60_000);
  assert.equal(validateResumeApproval(auth.approvalRaw, approval, bundle)?.releaseSha, auth.releaseSha);
  assert.throws(() => validateResumeApproval(undefined, approval, bundle), /ORIGINAL_APPROVAL_CHECKSUM_MISMATCH/);
  assert.throws(() => validateResumeApproval(auth.approvalRaw + ' ', approval, bundle));
  for (const change of [{ approvalFile: '../approval.json' }, { approvalSha256: '0'.repeat(64) },
    { releaseSha: 'x' }, { enumsCatalogSha256: '0'.repeat(64) }, { backupInventorySha256: 'invalid' }]) {
    const changed = { ...approval, resumeFrom: { ...approval.resumeFrom, ...change } };
    assert.throws(() => { const parsed = validateWriterApproval(changed, bundle, resumed.releaseSha, sha256(resumed.evidenceRaw), now + 60_000);
      validateResumeApproval(auth.approvalRaw, parsed, bundle); });
  }
  const noResume = { ...approval, resumeFrom: undefined };
  assert.throws(() => validateResumeApproval(auth.approvalRaw, noResume, bundle), /EXPLICIT_REVIEWED_RESUME_REQUIRED/);
  let queries = 0;
  const db: WriterSession = { query: async () => { queries++; throw new Error('must not query'); }, inventory: async () => auth.backupInventory };
  await assert.rejects(runReconciliationWriter(db, bundle, { ...resumed, originalApprovalRaw: undefined }, () => now + 60_000));
  await assert.rejects(runReconciliationWriter(db, bundle, resumed, () => now + 31 * 60_000), /APPROVED_MIGRATION_WINDOW_REQUIRED/);
  assert.equal(queries, 0);
});

test('unknown/native-spoofed extension members fail closed, never a broad extension bypass', () => {
  assert.deepEqual(validateManagedTrigram([]).signatures, []);
  for (const row of [{ signature: 'dangerous_rpc()', extension: 'pg_trgm', definer: true },
    { signature: 'similarity(text,text)', extension: 'pg_trgm', language: 'plpgsql' },
    { signature: 'similarity(text,text)', extension: 'unknown', language: 'c' }]) {
    assert.throws(() => validateManagedTrigram([row]), /UNREVIEWED_MANAGED_EXTENSION_REFUSED/);
  }
});
