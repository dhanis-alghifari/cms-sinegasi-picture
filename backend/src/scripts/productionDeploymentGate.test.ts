import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, chmod, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deploymentHash, inspectDeploymentSchema, requireDeploymentObservation, requireDeploymentWindow,
  requireProductionEnvironment, requireDeploymentQuality, validateDeploymentEvidence, type DeploymentEvidence } from './productionDeploymentGate.js';
import { readGateDocument, runDeploymentGate } from './productionDeploymentGateCli.js';
import { createWriterPackage } from './reconciliationWriterPolicy.js';
import { loadSnapshot } from './productionReconciliation.js';
import type { DatabaseInventory } from './productionBackupCore.js';
import pg from 'pg';
import { writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';

const now = Date.parse('2026-10-13T09:00:00.000Z'), release = '1'.repeat(40);
const hash = (character: string) => character.repeat(64);
const iso = (offset: number) => new Date(now + offset).toISOString();
function evidence(): DeploymentEvidence {
  const id = iso(-60_000).replace(/[:.]/g, '-');
  const archive = { sha256: hash('a'), bytes: 1024 }, metadata = { sha256: hash('b'), bytes: 512 };
  return { format: 1, mode: 'reconciled-no-sql', project: 'pvbdiftvzoeelibxlxzb', releaseSha: release,
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
      rollbackPassed: true, runtimePreflightPassed: true, productionChanged: false, devDatabaseChanged: false } };
}
function verify(e: unknown, raw = JSON.stringify(e)) {
  return validateDeploymentEvidence(raw, { releaseSha: release, evidenceSha256: deploymentHash(raw), snapshotSha256: hash('c'), packageSha256: hash('d'), now });
}
test('offline evidence binds exact reviewed bytes, project, release and reconciliation package', () => {
  assert.equal(verify(evidence()).mode, 'reconciled-no-sql');
  for (const change of [{ format: 2 }, { mode: 'apply-sql' }, { project: 'dev' }, { releaseSha: '2'.repeat(40) },
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
    await runDeploymentGate(['verify', '--evidence', path, '--confirm-evidence', deploymentHash(raw), '--snapshot', snapshotPath, '--release-sha', release]);
    assert.match(output[0], /RECONCILED_DEPLOYMENT_EVIDENCE_OFFLINE_VERIFIED/);
    assert.equal(connections, 0);
    await assert.rejects(runDeploymentGate(['inspect', '--evidence', path, '--confirm-evidence', deploymentHash(raw),
      '--snapshot', snapshotPath, '--release-sha', release, '--connection', '/never-read-credentials.json',
      '--window-start', iso(-1000), '--window-end', iso(0)]), /APPROVED_DEPLOYMENT_WINDOW_REQUIRED/);
    assert.equal(connections, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function schemaFixture() {
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
  const queries: string[] = [];
  const db: WriterSession = { inventory: async () => schemaDrift ? { ...inventory, structure: inventory.structure.slice(1) } : inventory,
    async query(sql, values) {
      queries.push(sql);
      if (/^(BEGIN|SET LOCAL|ROLLBACK)/.test(sql)) return { rows: [] };
      if (sql.includes('current_database()')) return { rows: [{ database: 'postgres', actor: 'postgres', readOnly, version: '170006' }] };
      if (sql.includes('AS present')) return { rows: [{ present: true }] };
      if (sql.includes('has_schema_privilege') && sql.includes('sinegasi_ops')) return { rows: [{ usage: false, create: false, access: exposed }] };
      if (sql.includes('FROM sinegasi_ops.production_reconciliation_runs')) return { rows: [{ stage, package_sha256: bundle.packageSha256,
        target_catalog_sha256: writerCatalogHash({ inventory: normalized, security }), approval_sha256: hash('f'), completion_authorization: null }] };
      if (sql.includes('FROM auth.users')) return { rows: [{ accounts: '0', objects: '0' }] };
      if (sql.includes('JOIN pg_language')) return { rows: [] };
      if (sql.includes('SELECT kind,name,metadata')) return { rows: security };
      if (sql.includes('co.conindid')) return { rows: snapshot.indexes.map(i => ({ name: i.name, definition: i.definition })) };
      if (sql.includes('FROM pg_policies')) return { rows: snapshot.policies.map(p => ({ ...p })) };
      if (sql.includes('reloptions AS options')) return { rows: snapshot.views.map(v => ({ name: v.name, options: v.options })) };
      if (sql.includes('p.prosrc AS body')) return { rows: snapshot.functions.map(f => {
        const path = f.config?.find(c => c.startsWith('search_path='))?.slice('search_path='.length);
        const search = !path ? 'pg_catalog, public, pg_temp' : path === '""' ? '""' : path.includes('pg_temp') ? path : path + ', pg_temp';
        return { signature: f.signature, definition: f.definition, body: /AS (\$[A-Za-z_0-9]*\$)([\s\S]*)\1\s*$/.exec(f.definition)?.[2],
          definer: f.securityDefiner, config: [...(f.config ?? []).filter(c => !c.startsWith('search_path=')), 'search_path=' + search] };
      }) };
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
  return { bundle, db, queries, mutate(scenario: string) { stage = scenario === 'incomplete' ? 'enums' : 'complete';
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
