import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, chmod, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deploymentHash, inspectDeploymentSchema, requireDeploymentObservation, requireDeploymentWindow,
  requireProductionEnvironment, requireDeploymentBindings, requireDeploymentQuality, validateDeploymentEvidence, type DeploymentEvidence,
  type LegacyDeploymentEvidence } from './productionDeploymentGate.js';
import { deploymentReviewPolicy, requireDeploymentDispatch, validateDeploymentReleaseArtifact, type DeploymentReviewPolicy } from './productionDeploymentReview.js';
import { readGateDocument, runDeploymentGate } from './productionDeploymentGateCli.js';
import { createWriterPackage } from './reconciliationWriterPolicy.js';
import { loadSnapshot } from './productionReconciliation.js';
import type { DatabaseInventory } from './productionBackupCore.js';
import pg from 'pg';
import { writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';
import { photoMetadata } from './studentPhotoProductionFixtures.js';
import { readStudentPhotoSql, STUDENT_PHOTO_CHANGE, STUDENT_PHOTO_SIGNATURE, STUDENT_PHOTO_SQL_SHA256 } from './studentPhotoProductionPolicy.js';
import { applyStudentPhotoMigration, validateStudentPhotoApproval, type StudentPhotoAuthorization } from './studentPhotoProductionMigration.js';
import { APPROVED_BACKUP_ROLE_POLICY } from './productionBackupRolePolicy.js';
import { backupRoleFixture, backupMembershipFixture, backupSecurityFixture } from './productionBackupRoleFixtures.js';

const now = Date.parse('2026-10-13T09:00:00.000Z'), release = '1'.repeat(40);
const hash = (character: string) => character.repeat(64);
const iso = (offset: number) => new Date(now + offset).toISOString();
const solo: DeploymentReviewPolicy = { mode: 'solo-owner', owner: 'dhanis-alghifari', soloRiskAccepted: true };
const mediaFlags = ['--r2-account', 'a'.repeat(32), '--r2-bucket', 'fixture-prod', '--review-mode', 'solo-owner'];
function evidence(): LegacyDeploymentEvidence {
  const id = iso(-60_000).replace(/[:.]/g, '-');
  const archive = { sha256: hash('a'), bytes: 1024 }, metadata = { sha256: hash('b'), bytes: 512 };
  return { format: 2, mode: 'reconciled-no-sql', project: 'pvbdiftvzoeelibxlxzb', releaseSha: release,
    snapshotSha256: hash('c'), observedAt: iso(-30_000),
    observation: { packageSha256: hash('d'), targetCatalogSha256: hash('e'), schemaSecuritySha256: hash('e'),
      migrationApprovalSha256: hash('f'), managedExtensionSha256: hash('a') },
    backup: { project: 'pvbdiftvzoeelibxlxzb', id, encrypted: true, productionChanged: false, archive, metadata },
    restore: { project: 'pvbdiftvzoeelibxlxzb', id, status: 'PUBLIC_APPLICATION_RESTORE_VERIFIED', archiveSha256: archive.sha256,
      productionChanged: false, checks: { tableRowsAndRlsMatch: true, columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch: true, publicExtensionsMatch: true } },
    copy: { status: 'ENCRYPTED_VPS_COPY_VERIFIED', project: 'pvbdiftvzoeelibxlxzb', id, verifiedAt: iso(-45_000),
      host: '43.157.242.8', sameHostAsApplication: true,
      destination: `/opt/sinegasi-backups/production/${id}`, offDeviceBackupCopyVerified: true, decryptionKeyTransferred: false,
      databaseCredentialsTransferred: false, productionChanged: false, devCaddyUnchanged: true, directoryMode: '0700', fileMode: '0600', owner: 'root',
      files: [{ name: 'database.dump.age', ...archive }, { name: 'metadata.json.age', ...metadata }] },
    independentKeyRecovery: { verified: true, sameDeviceAsMac: false, sameHostAsApplication: false, verifiedAt: iso(-30_000),
      medium: 'SYNTHETIC OFFLINE TEST ONLY', verifiedBy: 'fixture' },
    rehearsal: { status: 'ISOLATED_DEPLOYMENT_REHEARSAL_PASSED', releaseSha: release, packageSha256: hash('d'), verifiedAt: iso(-30_000),
      rollbackPassed: true, runtimePreflightPassed: true, productionChanged: false, devDatabaseChanged: false },
    reviewPolicy: { ...solo }, media: { mode: 'authenticated-proxy', verification: 'owner-attested', accountId: 'a'.repeat(32),
      bucket: 'fixture-prod', developmentBucket: 'fixture-dev', r2DevEnabled: false, enabledCustomDomains: 0,
      publicWorkerRoutes: false, credentialsBucketScoped: true, verifiedAt: iso(-30_000), verifiedBy: 'dhanis-alghifari' } };
}
function verify(e: unknown, raw = JSON.stringify(e)) {
  return validateDeploymentEvidence(raw, { releaseSha: release, evidenceSha256: deploymentHash(raw), snapshotSha256: hash('c'), packageSha256: hash('d'), now });
}
test('offline evidence binds exact reviewed bytes, project, release and reconciliation package', () => {
  assert.equal(verify(evidence()).mode, 'reconciled-no-sql');
  for (const change of [{ format: 1 }, { mode: 'apply-sql' }, { project: 'dev' }, { releaseSha: '2'.repeat(40) },
    { snapshotSha256: hash('0') }, { approved: true }, { operation: 'reset' }, { observedAt: iso(1) },
    { observedAt: iso(-30 * 60_000 - 1) }, { observedAt: '2026-02-30T09:00:00.000Z' }]) assert.throws(() => verify({ ...evidence(), ...change }));
  const raw = JSON.stringify(evidence());
  assert.throws(() => validateDeploymentEvidence(raw + ' ', { releaseSha: release, evidenceSha256: deploymentHash(raw), snapshotSha256: hash('c'), packageSha256: hash('d'), now }));
  assert.throws(() => verify(evidence(), '{malformed json'));
  assert.throws(() => verify(evidence(), ' '.repeat(262145)));
  assert.throws(() => verify(evidence(), raw.replace('"mode":"reconciled-no-sql"', '"mode":"apply-sql","mode":"reconciled-no-sql"')));
});
test('incomplete/drifting postcondition refuses even when table count looks correct', () => {
  const expected = evidence().observation;
  requireDeploymentObservation(expected, expected);
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    assert.throws(() => requireDeploymentObservation({ ...expected, [key]: hash('0') }, expected));
  }
  assert.throws(() => verify({ ...evidence(), observation: { ...expected, packageSha256: hash('0') } }));
  assert.throws(() => verify({ ...evidence(), observation: { ...expected, stage: 'enums' } }));
});
test('fresh ciphertext, real restore checks and matching copied assets are mandatory', () => {
  const mutations: Array<(e: DeploymentEvidence) => void> = [
    e => { e.backup.id = '../escape'; }, e => { e.backup.id = '2026-10-13T06-00-00-000Z'; },
    e => { e.backup.encrypted = false; }, e => { e.restore.archiveSha256 = hash('0'); },
    e => { e.restore.status = 'BACKUP_CREATED_RESTORE_NOT_YET_VERIFIED'; }, e => { e.restore.checks = {}; },
    e => { e.copy.files = []; }, e => { e.copy.owner = 'ubuntu'; }, e => { e.copy.fileMode = '0644'; },
    e => { e.copy.decryptionKeyTransferred = true; }, e => { e.copy.verifiedAt = iso(1); },
    e => { e.copy.files = [...e.copy.files as object[], ...(e.copy.files as object[]).slice(0, 1)]; },
    e => { e.rehearsal.releaseSha = '2'.repeat(40); }, e => { e.rehearsal.rollbackPassed = false; },
    e => { e.rehearsal.productionChanged = true; }, e => { e.rehearsal.verifiedAt = iso(-3 * 60 * 60_000); },
  ];
  for (const mutate of mutations) { const e = evidence(); mutate(e); assert.throws(() => verify(e)); }
});
test('initialization-only Mac key exceptions cannot become public deployment approval', () => {
  for (const change of [{ verified: false }, { sameDeviceAsMac: true }, { sameHostAsApplication: true },
    { verifiedBy: '' }, { verifiedAt: iso(1) }, { force: true }]) {
    const e = evidence(); e.independentKeyRecovery = { ...e.independentKeyRecovery, ...change }; assert.throws(() => verify(e));
  }
});
test('deployment window is strict UTC, inclusive start, exclusive end and at most 45 minutes', () => {
  requireDeploymentWindow(iso(0), iso(45 * 60_000), now);
  for (const [start, end] of [[iso(1), iso(1000)], [iso(-1000), iso(0)], [iso(0), iso(45 * 60_000 + 1)],
    [iso(0), iso(-1)], ['invalid', iso(1000)], ['2026-10-13T16:00:00+07:00', iso(1000)]]) {
    assert.throws(() => requireDeploymentWindow(start, end, now));
  }
});
test('private document reader rejects public modes, symlinks and oversized files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sinegasi-gate-test-'));
  try {
    const file = join(directory, 'synthetic.json'); await writeFile(file, '{}', { mode: 0o600 });
    assert.equal(await readGateDocument(file, true), '{}');
    const link = join(directory, 'link'); await symlink(file, link); await assert.rejects(readGateDocument(link, true));
    await chmod(file, 0o644); await assert.rejects(readGateDocument(file, true));
    await chmod(file, 0o600); await writeFile(file, 'x'.repeat(262145)); await assert.rejects(readGateDocument(file, true));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('CLI rejects implicit/duplicate/mutation modes before any credential/file access', async () => {
  for (const args of [[], ['apply'], ['reset'], ['inspect'], ['verify', '--force', 'yes'],
    ['verify', '--evidence', '/never', '--evidence', '/never', '--snapshot', '/never', '--release-sha', release]]) {
    await assert.rejects(runDeploymentGate(args));
  }
});

test('offline CLI verifies the real 73-table snapshot with synthetic receipts and zero database connects', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'sinegasi-gate-cli-test-'));
  t.mock.method(Date, 'now', () => now);
  let connections = 0; const output: string[] = [];
  t.mock.method(pg.Client.prototype, 'connect', () => { connections++; throw new Error('NETWORK_FORBIDDEN_IN_TEST'); });
  t.mock.method(console, 'log', (value: string) => { output.push(value); });
  try {
    const snapshotPath = resolve(__dirname, '../../../ops/production-schema.snapshot.json');
    const rawSnapshot = await readGateDocument(snapshotPath, false);
    const bundle = createWriterPackage(await loadSnapshot(resolve(__dirname, '../../..')));
    const e = evidence(); e.snapshotSha256 = deploymentHash(rawSnapshot); e.observation.packageSha256 = bundle.packageSha256;
    e.rehearsal.packageSha256 = bundle.packageSha256;
    const raw = JSON.stringify(e), path = join(directory, 'SYNTHETIC-NOT-APPROVAL.json');
    await writeFile(path, raw, { mode: 0o600 });
    await runDeploymentGate(['verify', '--evidence', path, '--confirm-evidence', deploymentHash(raw), '--snapshot', snapshotPath, '--release-sha', release, ...mediaFlags]);
    assert.match(output[0], /RECONCILED_DEPLOYMENT_EVIDENCE_OFFLINE_VERIFIED/);
    assert.equal(connections, 0);
    await assert.rejects(runDeploymentGate(['inspect', '--evidence', path, '--confirm-evidence', deploymentHash(raw),
      '--snapshot', snapshotPath, '--release-sha', release, ...mediaFlags, '--connection', '/never-read-credentials.json',
      '--window-start', iso(-1000), '--window-end', iso(0)]), /APPROVED_DEPLOYMENT_WINDOW_REQUIRED/);
    assert.equal(connections, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('private media attestation is fresh, explicit, isolated from DEV and bound to runtime approval', () => {
  const e = evidence();
  requireDeploymentBindings(verify(e), 'a'.repeat(32), 'fixture-prod', 'solo-owner');
  for (const change of [{ r2DevEnabled: true }, { enabledCustomDomains: 1 }, { publicWorkerRoutes: true },
    { credentialsBucketScoped: false }, { verification: 'live-verified' }, { bucket: 'fixture-dev' },
    { accountId: 'account' }, { bucket: 'https://public.invalid' }, { bucket: '-bad' }, { verifiedBy: 'someone' },
    { verifiedAt: iso(1) }, { verifiedAt: iso(-30 * 60_000 - 1) }, { verifiedAt: iso(-29_000) }, { force: true }]) {
    assert.throws(() => verify({ ...evidence(), media: { ...evidence().media, ...change } }));
  }
  assert.throws(() => requireDeploymentBindings(e, 'b'.repeat(32), 'fixture-prod', 'solo-owner'));
  assert.throws(() => requireDeploymentBindings(e, 'a'.repeat(32), 'fixture-dev', 'solo-owner'));
  assert.throws(() => requireDeploymentBindings(e, 'a'.repeat(32), 'fixture-prod', 'independent-review'));
});

test('solo approval is opt-in and explicit, not an implicit independent-review bypass', () => {
  for (const change of [{ soloRiskAccepted: false }, { owner: 'other' }, { mode: 'auto' }, { approved: true }]) {
    assert.throws(() => deploymentReviewPolicy({ ...solo, ...change }));
    assert.throws(() => verify({ ...evidence(), reviewPolicy: { ...solo, ...change } }));
  }
  assert.throws(() => deploymentReviewPolicy({ mode: 'solo-owner' }));
  const environment = { name: 'production', protection_rules: [], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } };
  const branches = { total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] };
  requireProductionEnvironment(environment, branches, solo);
  assert.throws(() => requireProductionEnvironment(environment, branches)); // strict default preserved
  assert.throws(() => requireProductionEnvironment(environment, { ...branches, total_count: 0 }, solo));
  assert.throws(() => requireProductionEnvironment({ ...environment, can_admins_bypass: true }, branches, solo));
  const dispatch = { repository: 'dhanis-alghifari/cms-sinegasi-picture', actor: 'dhanis-alghifari', event: 'workflow_dispatch',
    ref: 'refs/heads/main', workflowSha: release, releaseSha: release, runId: '123', runAttempt: '1' };
  requireDeploymentDispatch(dispatch, solo);
  for (const change of [{ actor: 'other' }, { repository: 'fork/cms-sinegasi-picture' }, { event: 'push' },
    { ref: 'refs/heads/develop' }, { workflowSha: '2'.repeat(40) }, { runAttempt: '2' }, { runId: '' }]) {
    assert.throws(() => requireDeploymentDispatch({ ...dispatch, ...change }, solo));
  }
});

test('separate deploy dispatch requires exact successful build artifact provenance', () => {
  const artifact = { format: 1 as const, releaseSha: release, buildRunId: '123',
    image: `ghcr.io/dhanis-alghifari/cms-sinegasi-picture/api@sha256:${hash('a')}`,
    packageSha256: hash('b'), evidenceSha256: hash('c') };
  const run = { id: 123, head_sha: release, head_branch: 'main', path: '.github/workflows/deploy-prod.yml',
    event: 'workflow_dispatch', status: 'completed', conclusion: 'success', run_attempt: 1,
    repository: { full_name: 'dhanis-alghifari/cms-sinegasi-picture' } };
  const jobs = { jobs: [{ name: 'build-release', status: 'completed', conclusion: 'success' }] };
  const raw = JSON.stringify(artifact);
  validateDeploymentReleaseArtifact(raw, artifact, run, jobs);
  for (const change of [{ buildRunId: '456' }, { releaseSha: '2'.repeat(40) }, { packageSha256: hash('d') },
    { evidenceSha256: hash('e') }, { image: artifact.image + ':latest' }, { approved: true }]) {
    assert.throws(() => validateDeploymentReleaseArtifact(JSON.stringify({ ...artifact, ...change }), artifact, run, jobs));
  }
  for (const change of [{ id: 456 }, { event: 'push' }, { path: '.github/workflows/quality.yml' },
    { conclusion: 'failure' }, { run_attempt: 2 }, { head_branch: 'develop' }, { head_sha: '2'.repeat(40) },
    { repository: { full_name: 'fork/cms-sinegasi-picture' } }]) {
    assert.throws(() => validateDeploymentReleaseArtifact(raw, artifact, { ...run, ...change }, jobs));
  }
  for (const value of [{ jobs: [] }, { jobs: [...jobs.jobs, ...jobs.jobs] },
    { jobs: [{ name: 'build-release', status: 'completed', conclusion: 'skipped' }] }]) {
    assert.throws(() => validateDeploymentReleaseArtifact(raw, artifact, run, value));
  }
  assert.throws(() => validateDeploymentReleaseArtifact(raw + '\n', artifact, run, jobs));
});

async function schemaFixture(withBackupRole = false) {
  const photoSql = await readStudentPhotoSql(), photo = photoMetadata(photoSql);
  const bundle = createWriterPackage(await loadSnapshot(resolve(__dirname, '../../..')));
  const snapshot = bundle.snapshot;
  const inventory: DatabaseInventory = { tables: snapshot.tables.map(t => ({ schema: 'public', name: t.relname, rows: '999', rls: true, forceRls: false })),
    structure: [
      ...snapshot.tables.flatMap(t => t.columns.map(c => ({ kind: 'column', name: t.relname + '.' + c.name,
        definition: JSON.stringify({ type: c.type, notNull: c.notNull, default: c.default, identity: c.identity, generated: '' }) }))),
      ...snapshot.constraints.map(c => ({ kind: 'constraint', name: c.table + '.' + c.name, definition: c.definition })),
      ...snapshot.enums.map(e => ({ kind: 'enum', name: e.name, definition: JSON.stringify(e.labels) })),
      ...snapshot.triggers.map(t => ({ kind: 'trigger', name: t.table + '.' + t.name, definition: t.definition })),
      ...snapshot.views.map(v => ({ kind: 'view', name: v.name, definition: v.definition })),
    ], extensions: [], roles: [{ name: 'service_role', inherit: true, bypassRls: true }] };
  const security: Record<string, unknown>[] = [];
  const normalized = { ...inventory, tables: inventory.tables.map(t => ({ ...t, rows: String(bundle.reference.tables.find(r => r.name === t.name)?.rows.length ?? 0) })) };
  let stage = 'complete', readOnly = 'on', exposed = false, schemaDrift = false;
  let photoInstalled = false, photoAtBegin: boolean | undefined;
  const photoObject = { kind: 'function', name: STUDENT_PHOTO_SIGNATURE, definition: photoSql };
  const liveInventory = () => ({ ...inventory, roles: [...inventory.roles,
    ...(withBackupRole ? [{ name: 'sinegasi_backup', inherit: true, bypassRls: true }] : [])],
    structure: [...(schemaDrift ? inventory.structure.slice(1) : inventory.structure),
    ...(photoInstalled ? [photoObject] : [])] });
  const liveSecurity = () => [...security, ...(photoInstalled ? [photoObject] : []), ...(withBackupRole ? backupSecurityFixture() : [])];
  const queries: string[] = [];
  const db: WriterSession = { inventory: async () => liveInventory(),
    async query(sql, values) {
      queries.push(sql);
      if (sql.includes('rolvaliduntil')) return { rows: withBackupRole ? [backupRoleFixture()] : [] };
      if (sql.includes('pg_catalog.pg_auth_members')) return { rows: backupMembershipFixture() };
      if (sql.includes('pg_db_role_setting')) return { rows: [{ count: 0 }] };
      if (sql.startsWith('BEGIN')) { photoAtBegin = photoInstalled; return { rows: [] }; }
      if (sql === 'ROLLBACK') { if (photoAtBegin !== undefined) photoInstalled = photoAtBegin; photoAtBegin = undefined; return { rows: [] }; }
      if (sql === 'COMMIT') { photoAtBegin = undefined; return { rows: [] }; }
      if (/^(SET LOCAL|LOCK TABLE)/.test(sql)) return { rows: [] };
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('count(*)::int AS count')) return { rows: [{ count: photoInstalled ? 1 : 0 }] };
      if (sql === photoSql) { photoInstalled = true; return { rows: [] }; }
      if (sql.includes('current_database()')) return { rows: [{ database: 'postgres', actor: 'postgres', readOnly, version: '170006', pid: 123 }] };
      if (sql.includes('pg_catalog.to_regprocedure($1)')) return { rows: photoInstalled ? [photo] : [] };
      if (sql.includes('AS present')) return { rows: [{ present: true }] };
      if (sql.includes('has_schema_privilege') && sql.includes('sinegasi_ops')) return { rows: [{ usage: false, create: false, access: exposed }] };
      if (sql.includes('FROM sinegasi_ops.production_reconciliation_runs')) return { rows: [{ stage, package_sha256: bundle.packageSha256,
        target_catalog_sha256: writerCatalogHash({ inventory: normalized, security }), approval_sha256: hash('f'), completion_authorization: null }] };
      if (sql.includes('FROM auth.users')) return { rows: [{ accounts: '0', objects: '0' }] };
      if (sql.includes('JOIN pg_language')) return { rows: [] };
      if (sql.includes('SELECT kind,name,metadata')) return { rows: liveSecurity() };
      if (sql.includes('co.conindid')) return { rows: snapshot.indexes.map(i => ({ name: i.name, definition: i.definition })) };
      if (sql.includes('FROM pg_policies')) return { rows: snapshot.policies.map(p => ({ ...p })) };
      if (sql.includes('reloptions AS options')) return { rows: snapshot.views.map(v => ({ name: v.name, options: v.options })) };
      if (sql.includes('p.prosrc AS body')) return { rows: [...snapshot.functions.map(f => {
        const path = f.config?.find(c => c.startsWith('search_path='))?.slice('search_path='.length);
        const search = !path ? 'pg_catalog, public, pg_temp' : path === '""' ? '""' : path.includes('pg_temp') ? path : path + ', pg_temp';
        return { signature: f.signature, definition: f.definition, body: /AS (\$[A-Za-z_0-9]*\$)([\s\S]*)\1\s*$/.exec(f.definition)?.[2],
          definer: f.securityDefiner, config: [...(f.config ?? []).filter(c => !c.startsWith('search_path=')), 'search_path=' + search] };
      }), ...(photoInstalled ? [{ ...photo, signature: STUDENT_PHOTO_SIGNATURE, definition: photoSql }] : [])] };
      const reference = bundle.reference.tables.find(t => sql.includes(`FROM public."${t.name}"`));
      if (reference) return { rows: reference.rows.map(row => Object.fromEntries(reference.columns.map((c, i) => [c, row[i]]))) };
      if (sql.includes('AS tables')) return { rows: [{ tables: false, functions: false, create: false }] };
      if (sql.includes('AS read')) {
        const history = String(values?.[0]).endsWith('schema_migrations') || String(values?.[0]).endsWith('_migration_history');
        return { rows: [{ read: !history, insert: !history, update: !history, delete: !history }] };
      }
      if (sql.includes('AS missing_rpc')) return { rows: [{ missing_rpc: false, missing_view: false }] };
      throw new Error('UNEXPECTED_FIXTURE_QUERY');
    } };
  return { bundle, db, queries, installed: () => photoInstalled, mutate(scenario: string) { stage = scenario === 'incomplete' ? 'enums' : 'complete';
    readOnly = scenario === 'writable' ? 'off' : 'on'; exposed = scenario === 'exposed'; schemaDrift = scenario === 'drift'; } };
}
test('read-only adapter validates real verifier semantics without password/counter/SQL-package operations', async () => {
  const fixture = await schemaFixture();
  const observed = await inspectDeploymentSchema(fixture.db, fixture.bundle);
  assert.equal(observed.schemaSecuritySha256, observed.targetCatalogSha256);
  assert.equal(fixture.queries[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(fixture.queries.at(-1), 'ROLLBACK');
  assert.ok(fixture.queries.every(sql => /^(SELECT|BEGIN|SET LOCAL|ROLLBACK)/.test(sql)));
  assert.ok(fixture.queries.every(sql => !sql.includes('password_hash') && !sql.includes('to_jsonb(u)')));
  for (const scenario of ['incomplete', 'writable', 'exposed', 'drift']) {
    fixture.mutate(scenario); await assert.rejects(inspectDeploymentSchema(fixture.db, fixture.bundle));
    assert.equal(fixture.queries.at(-1), 'ROLLBACK');
  }
});

test('actual environment requires a separate reviewer and main-only branch policy, not READY alone', () => {
  const environment = { name: 'production', protection_rules: [{ type: 'required_reviewers', prevent_self_review: true,
    reviewers: [{ type: 'User', reviewer: { id: 1 } }] }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } };
  const branches = { total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] };
  requireProductionEnvironment(environment, branches);
  for (const change of [{ name: 'develop' }, { protection_rules: [] }, { can_admins_bypass: true },
    { deployment_branch_policy: null }, { protection_rules: [{ type: 'required_reviewers', prevent_self_review: false, reviewers: [] }] }]) {
    assert.throws(() => requireProductionEnvironment({ ...environment, ...change }, branches));
  }
  for (const value of [{ total_count: 0, branch_policies: [] }, { total_count: 2, branch_policies: branches.branch_policies },
    { total_count: 1, branch_policies: [{ name: '*', type: 'branch' }] }, { total_count: 1, branch_policies: [{ name: 'main', type: 'tag' }] }]) {
    assert.throws(() => requireProductionEnvironment(environment, value));
  }
});
test('quality must be exact successful pushed main backend and frontend, with current main unchanged', () => {
  const run = { head_sha: release, head_branch: 'main', path: '.github/workflows/quality.yml', status: 'completed', conclusion: 'success', event: 'push' };
  const jobs = { jobs: ['backend-quality', 'frontend-quality'].map(name => ({ name, status: 'completed', conclusion: 'success' })) };
  requireDeploymentQuality(run, jobs, release, { sha: release });
  assert.throws(() => requireDeploymentQuality(run, jobs, release, { sha: '2'.repeat(40) }));
  for (const change of [{ event: 'pull_request' }, { head_branch: 'develop' }, { conclusion: 'failure' }]) {
    assert.throws(() => requireDeploymentQuality({ ...run, ...change }, jobs, release, { sha: release }));
  }
  assert.throws(() => requireDeploymentQuality(run, { jobs: jobs.jobs.slice(0, 1) }, release, { sha: release }));
});

async function photoAuthorization(fixture: Awaited<ReturnType<typeof schemaFixture>>, withBackupRole = false): Promise<StudentPhotoAuthorization> {
  const observed = await inspectDeploymentSchema(fixture.db, fixture.bundle, undefined, withBackupRole ? APPROVED_BACKUP_ROLE_POLICY : undefined);
  const e = evidence(); e.observation = observed; e.rehearsal.packageSha256 = fixture.bundle.packageSha256;
  const baselineRaw = JSON.stringify(withBackupRole ? { ...e, format: 4, mode: 'reconciled-backup-role-v1', backupRolePolicy: APPROVED_BACKUP_ROLE_POLICY } : e);
  const rehearsalRaw = JSON.stringify({ status: 'STUDENT_PROFILE_AUDIT_REHEARSAL_OK', releaseSha: release,
    sqlSha256: STUDENT_PHOTO_SQL_SHA256, guardQualityRunId: 123, postgresMajor: 17, verifiedAt: iso(-30_000),
    cleanupVerified: true, productionChanged: false, devDatabaseChanged: false,
    checks: ['legacyFailureReproduced', 'auditedUpdatePassed', 'invalidActorReasonRefused',
      'auditFailureRollsBack', 'contextRestored', 'publicExecuteDenied'] });
  const approval = { format: 1, operation: STUDENT_PHOTO_CHANGE, project: e.project, releaseSha: release,
    sqlSha256: STUDENT_PHOTO_SQL_SHA256, baselineEvidenceSha256: deploymentHash(baselineRaw), qualityRunId: 123,
    rehearsalSha256: deploymentHash(rehearsalRaw),
    approvedBy: solo.owner, windowStart: iso(-60_000), windowEnd: iso(5 * 60_000),
    maintenanceWindowConfirmed: true, noOtherWriters: true, databaseRollbackCompatible: true, noDeploymentAuthorized: true };
  const approvalRaw = JSON.stringify(approval);
  return { baselineRaw, approvalRaw, rehearsalRaw, confirmApproval: deploymentHash(approvalRaw),
    context: { releaseSha: release, evidenceSha256: deploymentHash(baselineRaw), snapshotSha256: hash('c'),
      packageSha256: fixture.bundle.packageSha256 } };
}
test('additive approval rejects mismatched SQL/release/evidence, scope expansion and stale protection receipts', async () => {
  const fixture = await schemaFixture(), auth = await photoAuthorization(fixture);
  validateStudentPhotoApproval(auth, now);
  const original = JSON.parse(auth.approvalRaw);
  for (const change of [{ operation: 'run-all-migrations' }, { sqlSha256: hash('0') }, { releaseSha: '2'.repeat(40) },
    { baselineEvidenceSha256: hash('0') }, { approvedBy: 'other' }, { noOtherWriters: false },
    { noDeploymentAuthorized: false }, { qualityRunId: 0 }, { force: true }, { windowEnd: iso(0) }]) {
    const approvalRaw = JSON.stringify({ ...original, ...change });
    assert.throws(() => validateStudentPhotoApproval({ ...auth, approvalRaw, confirmApproval: deploymentHash(approvalRaw) }, now));
  }
  const independent = { ...JSON.parse(auth.baselineRaw), reviewPolicy: {
    mode: 'independent-review', owner: solo.owner, soloRiskAccepted: false,
  } };
  const baselineRaw = JSON.stringify(independent);
  const approvalRaw = JSON.stringify({ ...original, baselineEvidenceSha256: deploymentHash(baselineRaw) });
  assert.throws(() => validateStudentPhotoApproval({ ...auth, baselineRaw, approvalRaw,
    confirmApproval: deploymentHash(approvalRaw), context: { ...auth.context, evidenceSha256: deploymentHash(baselineRaw) } }, now),
  /EXPLICIT_SOLO_OWNER_REQUIRED/);
  for (const change of [{ postgresMajor: 16 }, { cleanupVerified: false }, { productionChanged: true },
    { devDatabaseChanged: true }, { checks: [] }, { verifiedAt: iso(-3 * 60 * 60_000) }, { guardQualityRunId: 456 },
    { releaseSha: '2'.repeat(40) }, { isolatedFixture: true }]) {
    const rehearsalRaw = JSON.stringify({ ...JSON.parse(auth.rehearsalRaw), ...change });
    const approvalRaw = JSON.stringify({ ...original, rehearsalSha256: deploymentHash(rehearsalRaw) });
    assert.throws(() => validateStudentPhotoApproval({ ...auth, rehearsalRaw, approvalRaw, confirmApproval: deploymentHash(approvalRaw) }, now));
  }
  assert.throws(() => validateStudentPhotoApproval({ ...auth, approvalRaw: auth.approvalRaw + '\n' }, now));
  const raw = auth.approvalRaw.replace('"format":1', '"format":0,"format":1');
  assert.throws(() => validateStudentPhotoApproval({ ...auth, approvalRaw: raw, confirmApproval: deploymentHash(raw) }, now));
});
test('approved backup delta is opt-in, retains old checkpoint and composes with the photo transaction', async () => {
  const fixture = await schemaFixture(true);
  await assert.rejects(inspectDeploymentSchema(fixture.db, fixture.bundle));
  const auth = await photoAuthorization(fixture, true);
  assert.equal(validateStudentPhotoApproval(auth, now).baseline.format, 4);
  const baseline = JSON.parse(auth.baselineRaw);
  for (const altered of [{ ...baseline, format: 2, mode: 'reconciled-no-sql' },
    { ...baseline, backupRolePolicy: 'any-backup-role' }, { ...baseline, unexpected: true }]) {
    const raw = JSON.stringify(altered);
    assert.throws(() => validateDeploymentEvidence(raw, { ...auth.context, evidenceSha256: deploymentHash(raw), now }));
  }
  fixture.mutate('writable');
  const receipt = await applyStudentPhotoMigration(fixture.db, fixture.bundle, auth, { now: () => now, revalidate: async () => {} });
  fixture.mutate('normal');
  await assert.rejects(inspectDeploymentSchema(fixture.db, fixture.bundle, receipt));
  const observed = await inspectDeploymentSchema(fixture.db, fixture.bundle, receipt, APPROVED_BACKUP_ROLE_POLICY);
  const raw = JSON.stringify({ ...baseline, format: 5, mode: 'reconciled-backup-role-student-photo-v1',
    studentPhotoChange: receipt, observation: observed, observedAt: iso(0) });
  assert.equal(validateDeploymentEvidence(raw, { ...auth.context, evidenceSha256: deploymentHash(raw), now }).format, 5);
  assert.equal(receipt.beforeCatalogSha256, baseline.observation.targetCatalogSha256);
  assert.ok(!fixture.queries.some(sql => /^(GRANT|REVOKE|ALTER ROLE|UPDATE sinegasi_ops)/.test(sql)));
  fixture.mutate('drift');
  await assert.rejects(inspectDeploymentSchema(fixture.db, fixture.bundle, receipt, APPROVED_BACKUP_ROLE_POLICY));
});
test('approved runner applies one fixed SQL transaction; legacy deploy still rejects the changed catalog', async () => {
  const fixture = await schemaFixture(), auth = await photoAuthorization(fixture);
  fixture.mutate('writable'); fixture.queries.length = 0;
  let liveChecks = 0;
  const receipt = await applyStudentPhotoMigration(fixture.db, fixture.bundle, auth, {
    now: () => now, revalidate: async () => { liveChecks++; },
  });
  assert.equal(liveChecks, 2); assert.equal(fixture.installed(), true);
  assert.equal(fixture.queries.filter(sql => sql.startsWith('-- Additive rollout:')).length, 1);
  assert.equal(fixture.queries.at(-1), 'COMMIT');
  assert.ok(fixture.queries.some(sql => sql.includes('pg_try_advisory_xact_lock')));
  assert.ok(fixture.queries.every(sql => !/^(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i.test(sql)));
  fixture.mutate('normal');
  await assert.rejects(inspectDeploymentSchema(fixture.db, fixture.bundle)); // No implicit legacy allowlist.
  const observed = await inspectDeploymentSchema(fixture.db, fixture.bundle, receipt);
  const baseline = JSON.parse(auth.baselineRaw) as LegacyDeploymentEvidence;
  const e: DeploymentEvidence = { ...baseline, format: 3, mode: 'reconciled-student-photo-v1',
    studentPhotoChange: receipt, observation: observed, observedAt: iso(0) };
  assert.equal(validateDeploymentEvidence(JSON.stringify(e), { ...auth.context,
    evidenceSha256: deploymentHash(JSON.stringify(e)), now }).format, 3);
  for (const change of [{ format: 2 }, { mode: 'reconciled-no-sql' }, { studentPhotoChange: { ...receipt, sqlSha256: hash('0') } },
    { independentKeyRecovery: { ...e.independentKeyRecovery, verified: false } }]) assert.throws(() =>
    validateDeploymentEvidence(JSON.stringify({ ...e, ...change }), { ...auth.context,
      evidenceSha256: deploymentHash(JSON.stringify({ ...e, ...change })), now }));
  fixture.mutate('drift');
  await assert.rejects(inspectDeploymentSchema(fixture.db, fixture.bundle, receipt));
  fixture.mutate('writable'); fixture.queries.length = 0;
  await assert.rejects(applyStudentPhotoMigration(fixture.db, fixture.bundle, auth, {
    now: () => now, revalidate: async () => {},
  }), /ALREADY_PRESENT_INSPECT_DO_NOT_RETRY/);
  assert.equal(fixture.queries.filter(sql => sql.startsWith('-- Additive rollout:')).length, 0);
});
test('release revocation or expiry after DDL rolls back; lost COMMIT reply is never retried', async () => {
  for (const scenario of ['revoked', 'expired', 'commit-uncertain']) {
    const fixture = await schemaFixture(), auth = await photoAuthorization(fixture);
    fixture.mutate('writable');
    let checks = 0, clock = now;
    const live = { now: () => clock, revalidate: async () => {
      checks++;
      if (checks === 2 && scenario === 'revoked') throw new Error('SYNTHETIC_REVOKED');
      if (checks === 2 && scenario === 'expired') clock += 6 * 60_000;
    } };
    if (scenario === 'commit-uncertain') {
      const original = fixture.db.query.bind(fixture.db);
      fixture.db.query = async (sql, parameters) => {
        const result = await original(sql, parameters);
        if (sql === 'COMMIT') throw new Error('SYNTHETIC_COMMIT_REPLY_LOST');
        return result;
      };
    }
    fixture.queries.length = 0;
    await assert.rejects(applyStudentPhotoMigration(fixture.db, fixture.bundle, auth, live),
      scenario === 'commit-uncertain' ? /COMMIT_UNCERTAIN_INSPECT_DO_NOT_RETRY/ : /SYNTHETIC_REVOKED|APPROVED_DEPLOYMENT_WINDOW_REQUIRED/);
    assert.equal(fixture.queries.at(-1), 'ROLLBACK');
    assert.equal(fixture.installed(), scenario === 'commit-uncertain');
    assert.equal(fixture.queries.filter(sql => sql.startsWith('-- Additive rollout:')).length, 1);
  }
});
