import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { databaseInventory, quoteIdentifier } from './productionBackupCore.js';
import { validateSnapshot } from './productionReconciliation.js';
import { runReconciliationWriter, type WriterAuthorization } from './reconciliationWriterCore.js';
import { readWriterCatalog, writerCatalogHash, verifyWriterTarget, type WriterSession } from './reconciliationWriterCatalog.js';
import { createWriterPackage, WriterError } from './reconciliationWriterPolicy.js';
import { writerFixtureAuthorization, WRITER_CHECKS } from './reconciliationWriterFixtures.js';

let stage = 'INITIALIZATION';
const connection = (): pg.Client => {
  const db = new pg.Client({ host: '127.0.0.1', port: 5432, database: 'postgres', user: 'postgres', connectionTimeoutMillis: 3000, query_timeout: 30000 });
  db.on('error', () => {}); return db;
};
async function main(): Promise<void> {
  if (process.argv.length !== 3 || process.argv[2] !== 'isolated-writer') throw new Error('ISOLATED_WRITER_MODE_REQUIRED');
  const snapshot: unknown = JSON.parse(await readFile(resolve(__dirname, '../production-schema.snapshot.json'), 'utf8'));
  validateSnapshot(snapshot);
  const bundle = createWriterPackage(snapshot), db = connection(); await db.connect();
  const session: WriterSession = { query: (sql, values) => db.query(sql, values ? [...values] : undefined), inventory: () => databaseInventory(db) };
  const clock = Date.now(), checks: Partial<Record<typeof WRITER_CHECKS[number], boolean>> = {};
  let fault: ((sql: string) => Promise<void>) | undefined;
  const intercepted: WriterSession = { ...session, query: async (sql, values) => { if (fault) await fault(sql); return session.query(sql, values); } };
  const run = (auth: WriterAuthorization, chosen = intercepted) => runReconciliationWriter(chosen, bundle, auth, () => clock);
  const failure = async (auth: WriterAuthorization, mutation: string, chosen = intercepted) => {
    await assert.rejects(run(auth, chosen), (error: unknown) => {
      assert.ok(error instanceof WriterError); assert.equal(error.mutation, mutation); return true;
    });
  };
  const setup = async (): Promise<WriterAuthorization> => {
    // This reset is confined to the labelled disposable fixture cluster; not exported as a production option.
    assert.equal((await db.query("SELECT current_setting('sinegasi.schema_rehearsal',true) AS marker")).rows[0].marker, 'on');
    await db.query('DROP SCHEMA IF EXISTS sinegasi_ops CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await db.query('CREATE EXTENSION pg_trgm WITH SCHEMA public; CREATE EXTENSION pgcrypto WITH SCHEMA public; CREATE EXTENSION "uuid-ossp" WITH SCHEMA public');
    for (const e of snapshot.enums) {
      const labels = e.name === 'user_role' ? e.labels.slice(0, -1) : e.labels;
      await db.query(`CREATE TYPE public.${quoteIdentifier(e.name)} AS ENUM (${labels.map(label => "'" + label.replaceAll("'", "''") + "'").join(',')})`);
    }
    for (const table of snapshot.legacyTables) {
      await db.query(`CREATE TABLE public.${quoteIdentifier(table.relname)} (${table.columns.map(c =>
        `${quoteIdentifier(c.name)} ${c.type}${c.default === null ? '' : ' DEFAULT ' + c.default}${c.notNull ? ' NOT NULL' : ''}`).join(',')})`);
      if (table.relrowsecurity) await db.query(`ALTER TABLE public.${quoteIdentifier(table.relname)} ENABLE ROW LEVEL SECURITY`);
    }
    const catalog = await readWriterCatalog(session);
    return writerFixtureAuthorization(bundle, catalog.inventory, writerCatalogHash(catalog), clock);
  };
  try {
    const marker = (await db.query("SELECT current_setting('sinegasi.schema_rehearsal',true) AS marker,current_setting('server_version') AS version")).rows[0];
    assert.equal(marker.marker, 'on', 'DISPOSABLE_CLUSTER_MARKER_REQUIRED'); assert.match(marker.version, /^17\./);
    await db.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS');
    let auth = await setup();
    const baseline = writerCatalogHash(await readWriterCatalog(session));
    stage = 'WRONG_IDENTITY';
    await failure(auth, 'none', { ...session, query: async (sql, values) => {
      const result = await session.query(sql, values);
      return sql.includes('pg_backend_pid()') ? { rows: [{ ...result.rows[0], database: 'dev' }] } : result;
    } }); checks.wrongIdentityRefused = true;
    stage = 'NONEMPTY';
    await db.query("INSERT INTO public.users(username,password_hash,role,nama) VALUES('fixture-only','not-live','teacher','fixture')");
    await failure(auth, 'none'); await db.query('DELETE FROM public.users');
    checks.nonemptyRefused = true;
    stage = 'CONCURRENT';
    const contender = connection(); await contender.connect();
    try {
      await contender.query("SELECT pg_advisory_lock(hashtext('sinegasi:schema-migrations'))");
      await failure(auth, 'none');
      await contender.query("SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations'))");
      await contender.query('BEGIN; LOCK TABLE public.users IN ROW EXCLUSIVE MODE');
      await failure(auth, 'none'); await contender.query('ROLLBACK');
    } finally { await contender.end(); }
    assert.equal(writerCatalogHash(await readWriterCatalog(session)), baseline); checks.concurrentRefused = true;
    stage = 'ENUM_ROLLBACK';
    fault = async sql => { if (sql.includes('ALTER TYPE')) await db.query('SELECT 1/0'); };
    await failure(auth, 'none'); fault = undefined;
    assert.equal(writerCatalogHash(await readWriterCatalog(session)), baseline);
    assert.equal((await db.query("SELECT to_regnamespace('sinegasi_ops') IS NULL AS absent")).rows[0].absent, true); checks.enumRollback = true;
    stage = 'SCHEMA_REFERENCE_ROLLBACK';
    fault = async sql => { if (sql.includes('INSERT INTO public."cash_settings"')) await db.query('SELECT 1/0'); };
    await failure(auth, 'enums'); fault = undefined;
    const checkpoint = await readWriterCatalog(session);
    assert.equal(checkpoint.inventory.tables.length, 17); assert.ok(checkpoint.inventory.tables.every(t => t.rows === '0'));
    assert.equal((await db.query('SELECT stage FROM sinegasi_ops.production_reconciliation_runs')).rows[0].stage, 'enums');
    checks.schemaAndReferenceRollback = true;
    stage = 'UNEXPECTED_RELATION'; let injected = false;
    fault = async sql => { if (!injected && sql.includes('INSERT INTO public."access_roles"')) {
      injected = true; await db.query('CREATE SEQUENCE public.unreviewed_fixture_sequence');
    } };
    await failure(auth, 'enums'); fault = undefined;
    assert.equal((await db.query("SELECT to_regclass('public.unreviewed_fixture_sequence') IS NULL AS absent")).rows[0].absent, true);
    checks.unexpectedRelationRefused = true;
    stage = 'RESUME';
    assert.equal((await run(auth)).mode, 'resumed'); checks.resumeAfterEnumCommit = true;
    const completed = await verifyWriterTarget(session, snapshot, bundle.reference);
    assert.equal(completed.inventory.tables.length, 73); assert.equal(completed.inventory.tables.reduce((sum, t) => sum + Number(t.rows), 0), 213);
    checks.fullCatalogVerified = true; checks.referenceRows213 = true;
    stage = 'NOOP';
    fault = async sql => { assert.doesNotMatch(sql.trim(), /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|GRANT|REVOKE)\b/i); };
    assert.equal((await run(auth)).mode, 'noop'); fault = undefined; checks.repeatVerifiedNoop = true;
    stage = 'DRIFT';
    await db.query('UPDATE public.cash_settings SET nominal_iuran_wajib=6000');
    await failure(auth, 'none'); await db.query('UPDATE public.cash_settings SET nominal_iuran_wajib=5000');
    await db.query('GRANT SELECT ON public.users TO anon'); await failure(auth, 'none');
    await db.query('REVOKE SELECT ON public.users FROM anon'); checks.driftRefused = true;
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await db.query('BEGIN'); await db.query('SET LOCAL ROLE ' + quoteIdentifier(role));
      await assert.rejects(db.query('SELECT * FROM sinegasi_ops.production_reconciliation_runs'), (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && e.code === '42501');
      await db.query('ROLLBACK');
    } checks.browserAndPrivateHistoryDenied = true;
    stage = 'ENUM_COMMIT_UNCERTAINTY';
    auth = await setup(); let commits = 0;
    const enumUncertain: WriterSession = { ...session, query: async (sql, values) => {
      const result = await session.query(sql, values);
      if (sql === 'COMMIT' && ++commits === 1) throw new Error('SIMULATED_LOST_COMMIT_RESPONSE');
      return result;
    } };
    await failure(auth, 'unknown', enumUncertain);
    assert.equal((await db.query('SELECT stage FROM sinegasi_ops.production_reconciliation_runs')).rows[0].stage, 'enums');
    assert.equal((await run(auth)).mode, 'resumed');
    stage = 'FINAL_COMMIT_UNCERTAINTY';
    auth = await setup(); commits = 0;
    const finalUncertain: WriterSession = { ...session, query: async (sql, values) => {
      const result = await session.query(sql, values);
      if (sql === 'COMMIT' && ++commits === 2) throw new Error('SIMULATED_LOST_COMMIT_RESPONSE');
      return result;
    } };
    await failure(auth, 'unknown', finalUncertain);
    assert.equal((await run(auth)).mode, 'noop'); checks.commitUncertaintyReported = true;
    stage = 'LEGACY_APPLY';
    auth = await setup(); assert.equal((await run(auth)).mode, 'applied');
    await verifyWriterTarget(session, snapshot, bundle.reference); checks.legacyApply = true;
    assert.ok(WRITER_CHECKS.every(check => checks[check] === true));
    console.log(JSON.stringify({ status: 'RECONCILIATION_WRITER_ISOLATED_PASSED', packageSha256: bundle.packageSha256,
      checks, postgresVersion: marker.version, tables: 73, referenceRows: 213,
      productionChanged: false, devDatabaseChanged: false, productionApproved: false, managedSupabaseIntegrationTested: false }));
  } finally { await db.end().catch(() => {}); }
}
if (require.main === module) void main().catch((error: unknown) => {
  console.log(JSON.stringify({ status: 'WRITER_ISOLATED_TEST_FAILED', stage,
    check: error instanceof WriterError ? error.stage : error instanceof assert.AssertionError ? 'ASSERTION_FAILED' : 'TEST_FAILED',
    code: typeof error === 'object' && error !== null && 'code' in error && /^[A-Z0-9_]+$/.test(String(error.code)) ? String(error.code) : undefined,
    productionChanged: false }));
});
