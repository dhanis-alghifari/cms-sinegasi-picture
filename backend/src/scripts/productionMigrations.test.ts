import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { applyAsset, applyReviewedManifest, createDraftManifest, discoverAssets, inspectDatabase, manifestFingerprint, productionProjectRef, validateManifest, validateReleaseManifest, type MigrationAsset, type MigrationDatabase, type ProductionManifest } from './productionMigrations.js';

const fixtureSql = 'BEGIN; CREATE TABLE test_fixture(id int); COMMIT;';
const fixture: MigrationAsset = { name: '090_test.sql', checksum: createHash('sha256').update(fixtureSql).digest('hex'), sql: fixtureSql };
const inventory = { tables: [], history: false };
const schemaFingerprint = createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
function approvedManifest(): ProductionManifest {
  const manifest = createDraftManifest([fixture]);
  manifest.status = 'approved';
  manifest.entries[0].decision = 'apply';
  manifest.approval = { releaseSha: 'b'.repeat(40), approvedBy: 'test operator', backupEvidence: 'test fixture', restoreEvidence: 'isolated restore fixture', rehearsalEvidence: 'isolated fixture', schemaFingerprint };
  return manifest;
}
test('offline release gate rejects draft, wrong release, bad fingerprint and known blocked historical assets', () => {
  const manifest = approvedManifest();
  assert.equal(validateReleaseManifest(manifest, [fixture], manifestFingerprint(manifest), 'b'.repeat(40)), manifest);
  assert.throws(() => validateReleaseManifest(manifest, [fixture], manifestFingerprint(manifest), 'a'.repeat(40)), /exact release/);
  assert.throws(() => validateReleaseManifest(manifest, [fixture], 'c'.repeat(64), 'b'.repeat(40)), /exact release/);
  assert.throws(() => validateReleaseManifest(createDraftManifest([fixture]), [fixture], '', 'b'.repeat(40)));
  const historical = discoverAssets();
  const unsafe = createDraftManifest(historical);
  unsafe.status = 'approved';
  unsafe.approval = manifest.approval;
  for (const entry of unsafe.entries) if (entry.decision !== 'exclude-development') entry.decision = 'apply';
  assert.throws(() => validateReleaseManifest(unsafe, historical, manifestFingerprint(unsafe), 'b'.repeat(40)), /belum aman/);
});
function fakeDatabase(failOn?: string, metadata: object = inventory, history: Record<string, unknown>[] = [], acquired = true) {
  const queries: { sql: string; values?: unknown[] }[] = [];
  const db: MigrationDatabase = { query: async (sql, values) => {
    queries.push({ sql, values });
    if (failOn && sql.includes(failOn)) throw new Error('simulated DB failure');
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired }] };
    if (sql.includes('jsonb_build_object')) return { rows: [{ inventory: metadata }] };
    if (sql.includes('SELECT migration_name, checksum')) return { rows: history };
    return { rows: [] };
  } };
  return { db, queries };
}
test('complete deterministic inventory uses full filenames including BOTH 054 and blocks all known mixed seeds', () => {
  const assets = discoverAssets();
  const manifest = createDraftManifest(assets);
  assert.equal(manifest.entries.filter((entry) => entry.name.startsWith('054_')).length, 2);
  assert.equal(manifest.entries.find((entry) => entry.name.startsWith('002_'))?.decision, 'exclude-development');
  for (const prefix of ['001_', '003_', '004_', '006_', '008_', '047_', '066_']) assert.equal(manifest.entries.find((entry) => entry.name.startsWith(prefix))?.decision, 'blocked');
  assert.throws(() => validateManifest(manifest, assets, true));
  assert.equal(manifestFingerprint(manifest), manifestFingerprint(createDraftManifest(assets)));
});
test('altered SQL checksums, skipped schema and seed inclusion are rejected', () => {
  const manifest = approvedManifest();
  manifest.entries[0].checksum = 'c'.repeat(64);
  assert.throws(() => validateManifest(manifest, [fixture], true));
  manifest.entries[0].checksum = fixture.checksum;
  manifest.entries[0].decision = 'exclude-development';
  assert.throws(() => validateManifest(manifest, [fixture], true));
  const seed = { ...fixture, name: '002_seed_data_development.sql' };
  const draft = createDraftManifest([seed]);
  draft.entries[0].decision = 'apply';
  assert.throws(() => validateManifest(draft, [seed], false));
});
test('approval proofs and exact confirmed manifest hash required before DB access', async () => {
  const { db, queries } = fakeDatabase();
  const manifest = approvedManifest();
  await assert.rejects(applyReviewedManifest(db, manifest, [fixture], 'd'.repeat(64)));
  assert.equal(queries.length, 0);
  manifest.approval = null;
  assert.throws(() => validateManifest(manifest, [fixture], true));
  manifest.projectRef = 'aaaaaaaaaaaaaaaaaaaa';
  assert.throws(() => validateManifest(manifest, [fixture], false));
});
test('DDL and history are inside the SAME transaction; failure rolls both back', async () => {
  const { db, queries } = fakeDatabase('INSERT INTO public.schema_migrations');
  await assert.rejects(applyAsset(db, fixture));
  assert.equal(queries[0].sql, 'BEGIN');
  assert.match(queries[2].sql, /CREATE TABLE/);
  assert.deepEqual(queries[3].values, [fixture.name, fixture.checksum]);
  assert.equal(queries.at(-1)?.sql, 'ROLLBACK');
  assert.equal(queries.some((query) => query.sql === 'COMMIT'), false);
});
test('existing schema with missing history cannot become a fake baseline', async () => {
  const metadata = { tables: [{ name: 'users', rls: true }], history: false };
  const { db, queries } = fakeDatabase(undefined, metadata);
  const manifest = approvedManifest();
  if (manifest.approval) manifest.approval.schemaFingerprint = createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
  await assert.rejects(applyReviewedManifest(db, manifest, [fixture], manifestFingerprint(manifest)), /rekonsiliasi/);
  assert.equal(queries.some((query) => query.sql.includes('CREATE TABLE')), false);
  assert.match(queries.at(-1)?.sql ?? '', /pg_advisory_unlock/);
});
test('changed schema since approval causes no schema/data writes', async () => {
  const { db, queries } = fakeDatabase(undefined, { tables: [{ name: 'unknown' }], history: false });
  const manifest = approvedManifest();
  await assert.rejects(applyReviewedManifest(db, manifest, [fixture], manifestFingerprint(manifest)), /Schema berubah/);
  assert.equal(queries.some((query) => query.sql.includes('CREATE TABLE')), false);
});
test('metadata history initialization failure rolls back before releasing session lock', async () => {
  const { db, queries } = fakeDatabase('ALTER TABLE public.schema_migrations');
  const manifest = approvedManifest();
  await assert.rejects(applyReviewedManifest(db, manifest, [fixture], manifestFingerprint(manifest)));
  assert.equal(queries.at(-2)?.sql, 'ROLLBACK');
  assert.match(queries.at(-1)?.sql ?? '', /pg_advisory_unlock/);
});
test('legacy, unknown, malformed and mismatched history refuses DDL without repairing records', async () => {
  const metadata = { tables: [{ name: 'schema_migrations', rls: true }], history: true };
  for (const history of [
    [{ migration_name: fixture.name, checksum: 'legacy-record' }],
    [{ migration_name: '999_unknown.sql', checksum: fixture.checksum }],
    [{ migration_name: fixture.name, checksum: 'f'.repeat(64) }],
    [{ migration_name: null, checksum: fixture.checksum }],
  ]) {
    const { db, queries } = fakeDatabase(undefined, metadata, history);
    const manifest = approvedManifest();
    if (manifest.approval) manifest.approval.schemaFingerprint = createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
    await assert.rejects(applyReviewedManifest(db, manifest, [fixture], manifestFingerprint(manifest)), /History legacy\/unknown\/checksum mismatch/);
    assert.equal(queries.some((query) => query.sql.includes('CREATE TABLE') || query.sql.includes('UPDATE public.schema_migrations')), false);
    assert.match(queries.at(-1)?.sql ?? '', /pg_advisory_unlock/);
  }
});
test('matching recorded full filename/checksum is not executed or inserted twice', async () => {
  const metadata = { tables: [{ name: 'schema_migrations', rls: true }], history: true };
  const { db, queries } = fakeDatabase(undefined, metadata, [{ migration_name: fixture.name, checksum: fixture.checksum }]);
  const manifest = approvedManifest();
  if (manifest.approval) manifest.approval.schemaFingerprint = createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
  assert.deepEqual(await applyReviewedManifest(db, manifest, [fixture], manifestFingerprint(manifest)), { applied: 0 });
  assert.equal(queries.some((query) => query.sql.includes('CREATE TABLE test_fixture') || query.sql.startsWith('INSERT INTO public.schema_migrations')), false);
});
test('held advisory lock rejects before inventory or transaction writes', async () => {
  const { db, queries } = fakeDatabase(undefined, inventory, [], false);
  const manifest = approvedManifest();
  await assert.rejects(applyReviewedManifest(db, manifest, [fixture], manifestFingerprint(manifest)), /Runner migration lain/);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /pg_try_advisory_lock/);
});
test('fingerprint captures trigger definitions/enabled state and raw ACLs including PUBLIC exposure', async () => {
  const base = {
    tables: [{ name: 'users', rls: true, force_rls: false, owner: 'postgres', acl: ['postgres=arwdDxt/postgres'] }],
    history: false,
    triggers: [{ table: 'users', name: 'account_guard', enabled: 'O', definition: 'BEFORE UPDATE EXECUTE FUNCTION account_guard()' }],
  };
  const first = fakeDatabase(undefined, base);
  const baseline = await inspectDatabase(first.db);
  assert.match(first.queries[0].sql, /FROM pg_trigger/);
  assert.match(first.queries[0].sql, /t\.tgenabled/);
  assert.match(first.queries[0].sql, /pg_get_triggerdef/);
  assert.match(first.queries[0].sql, /c\.relacl/);
  for (const metadata of [
    { ...base, triggers: [{ ...base.triggers[0], enabled: 'D' }] },
    { ...base, triggers: [] },
    { ...base, tables: [{ ...base.tables[0], acl: [...base.tables[0].acl, '=r/postgres'] }] },
  ]) {
    const changed = await inspectDatabase(fakeDatabase(undefined, metadata).db);
    assert.notEqual(changed.fingerprint, baseline.fingerprint);
  }
});
test('approved empty fixture applies transaction then history once', async () => {
  const { db, queries } = fakeDatabase();
  const manifest = approvedManifest();
  assert.deepEqual(await applyReviewedManifest(db, manifest, [fixture], manifestFingerprint(manifest)), { applied: 1 });
  assert.equal(queries.filter((query) => query.sql.startsWith('INSERT INTO public.schema_migrations')).length, 1);
  assert.equal(manifest.projectRef, productionProjectRef);
});
