import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { databaseInventory, quoteIdentifier } from './productionBackupCore.js';
import { sha256, validateSnapshot } from './productionReconciliation.js';
import { runReconciliationWriter, type WriterAuthorization } from './reconciliationWriterCore.js';
import { readWriterCatalog, writerCatalogHash, verifyWriterTarget, type WriterSession } from './reconciliationWriterCatalog.js';
import { createWriterPackage, WriterError } from './reconciliationWriterPolicy.js';
import { readManagedTrigram } from './reconciliationWriterExtensions.js';
import { writerFixtureAuthorization, writerMacOnlyFixture, writerResumeFixture, WRITER_CHECKS } from './reconciliationWriterFixtures.js';

let stage = 'INITIALIZATION';
let writerFailureStage: string | undefined;
let writerMutation: string | undefined;
const connection = (user = 'postgres'): pg.Client => {
  const db = new pg.Client({ host: '127.0.0.1', port: 5432, database: 'postgres', user, connectionTimeoutMillis: 3000, query_timeout: 30000 });
  db.on('error', () => {}); return db;
};
async function main(): Promise<void> {
  if (process.argv.length !== 3 || process.argv[2] !== 'isolated-writer') throw new Error('ISOLATED_WRITER_MODE_REQUIRED');
  const snapshot: unknown = JSON.parse(await readFile(resolve(__dirname, '../production-schema.snapshot.json'), 'utf8'));
  validateSnapshot(snapshot);
  const bundle = createWriterPackage(snapshot);
  let db = connection(); await db.connect();
  const session: WriterSession = { query: (sql, values) => db.query(sql, values ? [...values] : undefined), inventory: () => databaseInventory(db) };
  const clock = Date.now(), checks: Partial<Record<typeof WRITER_CHECKS[number], boolean>> = {};
  let fault: ((sql: string) => Promise<void>) | undefined;
  const intercepted: WriterSession = { ...session, query: async (sql, values) => { if (fault) await fault(sql); return session.query(sql, values); } };
  const run = (auth: WriterAuthorization, chosen = intercepted) => runReconciliationWriter(chosen, bundle, auth, () => clock);
  const failure = async (auth: WriterAuthorization, mutation: string, chosen = intercepted) => {
    await assert.rejects(run(auth, chosen), (error: unknown) => {
      assert.ok(error instanceof WriterError);
      writerFailureStage = error.stage; writerMutation = error.mutation;
      assert.equal(error.mutation, mutation); return true;
    });
  };
  const setup = async (): Promise<WriterAuthorization> => {
    // This reset is confined to the labelled disposable fixture cluster; not exported as a production option.
    assert.equal((await db.query("SELECT current_setting('sinegasi.schema_rehearsal',true) AS marker")).rows[0].marker, 'on');
    await db.query('DROP SCHEMA IF EXISTS sinegasi_ops CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await db.query('DELETE FROM auth.users; DELETE FROM storage.objects');
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
    // Minimal managed-data counters only; this is NOT a managed Supabase integration test.
    await db.query('CREATE SCHEMA auth; CREATE TABLE auth.users(id integer); CREATE SCHEMA storage; CREATE TABLE storage.objects(id integer)');
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
    stage = 'MAC_ONLY_NONEMPTY_MANAGED';
    auth = writerMacOnlyFixture(await setup());
    const macBaseline = writerCatalogHash(await readWriterCatalog(session));
    for (const table of ['auth.users', 'storage.objects']) {
      await db.query(`INSERT INTO ${table}(id) VALUES(1)`);
      await assert.rejects(run(auth), (error: unknown) => {
        assert.ok(error instanceof WriterError); assert.equal(error.mutation, 'none');
        assert.equal(error.stage, 'MAC_ONLY_INITIALIZATION_REQUIRES_EMPTY_AUTH_AND_STORAGE'); return true;
      });
      assert.equal(writerCatalogHash(await readWriterCatalog(session)), macBaseline);
      await db.query(`DELETE FROM ${table}`);
    }
    const managedContender = connection(); await managedContender.connect();
    try {
      for (const table of ['auth.users', 'storage.objects']) {
        await managedContender.query(`BEGIN; LOCK TABLE ${table} IN ROW EXCLUSIVE MODE`);
        await failure(auth, 'none'); await managedContender.query('ROLLBACK');
        assert.equal(writerCatalogHash(await readWriterCatalog(session)), macBaseline);
      }
    } finally { await managedContender.end(); }
    const pendingWrite = connection(); await pendingWrite.connect();
    try {
      for (const [table, insertion, lockPrefix] of [
        ['auth.users', 'INSERT INTO auth.users(id) VALUES(3)', 'LOCK TABLE auth.users'],
        ['storage.objects', 'INSERT INTO storage.objects(id) VALUES(3)', 'LOCK TABLE auth.users'],
        ['public.users', "INSERT INTO public.users(username,password_hash,role,nama) VALUES('fixture-only','not-live','teacher','fixture')", 'LOCK TABLE public.'],
      ] as const) {
        await pendingWrite.query('BEGIN'); await pendingWrite.query(insertion); let committed = false;
        fault = async sql => { if (!committed && sql.startsWith(lockPrefix)) {
          committed = true; await pendingWrite.query('COMMIT');
        } };
        // A write committing just as the lock is requested must be visible, not hidden by an older snapshot.
        await failure(auth, 'none'); fault = undefined; assert.equal(committed, true);
        assert.equal((await db.query("SELECT to_regnamespace('sinegasi_ops') IS NULL AS absent")).rows[0].absent, true);
        await db.query(`DELETE FROM ${table}`);
        assert.equal(writerCatalogHash(await readWriterCatalog(session)), macBaseline);
      }
    } finally { fault = undefined; await pendingWrite.end(); }
    // A user appearing between commits must stop before schema/config writes, not bypass on resume.
    const afterEnum = connection(); await afterEnum.connect(); let inserted = false;
    try {
      fault = async sql => { if (sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ' && !inserted
        && (await afterEnum.query("SELECT to_regclass('sinegasi_ops.production_reconciliation_runs') IS NOT NULL AS history")).rows[0].history === true) {
        inserted = true; await afterEnum.query('INSERT INTO auth.users(id) VALUES(2)');
      } };
      await failure(auth, 'enums'); fault = undefined;
      assert.equal((await db.query('SELECT stage FROM sinegasi_ops.production_reconciliation_runs')).rows[0].stage, 'enums');
      assert.equal((await databaseInventory(db)).tables.length, 17);
      await failure(auth, 'enums');
      await db.query('DELETE FROM auth.users');
      assert.equal((await run(auth)).mode, 'resumed');
    } finally { fault = undefined; await afterEnum.end(); }
    checks.macOnlyNonemptyManagedRefused = true;
    stage = 'MAC_ONLY_INITIALIZATION';
    auth = writerMacOnlyFixture(await setup());
    const macResult = await run(auth);
    assert.equal(macResult.mode, 'applied'); assert.equal(macResult.recoveryMode, 'mac-only-initialization');
    assert.equal(macResult.independentKeyRecoveryAttested, false); assert.equal(macResult.managedAcceptanceRequired, true);
    await verifyWriterTarget(session, snapshot, bundle.reference);
    assert.equal((await run(auth)).mode, 'noop'); checks.macOnlyInitialization = true;

    stage = 'MANAGED_FIXTURE_RESET';
    await setup();
    stage = 'MANAGED_ROLE_SETUP';
    await db.query('CREATE ROLE supabase_admin LOGIN SUPERUSER');
    const admin = connection('supabase_admin'); await admin.connect();
    try {
      // Real restricted postgres versus admin-owned pg_trgm, not a mocked ACL result.
      stage = 'MANAGED_EXTENSION_RESET';
      await admin.query('DROP EXTENSION pg_trgm; CREATE EXTENSION pg_trgm WITH SCHEMA public');
      stage = 'MANAGED_RESTRICTED_ACTOR_SETUP';
      // PostgreSQL forbids removing SUPERUSER from its bootstrap OID. Rename
      // that test-only role and reconnect as a NEW restricted postgres instead.
      await admin.query(`ALTER ROLE postgres RENAME TO sinegasi_fixture_bootstrap;
        CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
        ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres;
        ALTER SCHEMA auth OWNER TO postgres; ALTER TABLE auth.users OWNER TO postgres;
        ALTER SCHEMA storage OWNER TO postgres; ALTER TABLE storage.objects OWNER TO postgres;
        CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO PUBLIC;
        ALTER EXTENSION pgcrypto SET SCHEMA extensions; ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions`);
      for (const e of snapshot.enums) await admin.query(`ALTER TYPE public.${quoteIdentifier(e.name)} OWNER TO postgres`);
      for (const t of snapshot.legacyTables) await admin.query(`ALTER TABLE public.${quoteIdentifier(t.relname)} OWNER TO postgres`);
      await db.end(); db = connection(); await db.connect();
      stage = 'MANAGED_POLICY_OBSERVATION';
      const actor = (await db.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0];
      assert.equal(actor.rolsuper, false);
      const managed = await readManagedTrigram(session);
      assert.equal(managed.signatures.length, 31);
      const legacy = await readWriterCatalog(session);
      const originalBase = writerMacOnlyFixture(writerFixtureAuthorization(bundle, legacy.inventory, writerCatalogHash(legacy), clock));
      const originalRaw = JSON.stringify({ ...JSON.parse(originalBase.approvalRaw) as Record<string, unknown>, managedExtensionSha256: managed.sha256 });
      const original = { ...originalBase, approvalRaw: originalRaw, confirmedApprovalSha256: sha256(originalRaw) };
      fault = async sql => {
        if (sql.includes('INSERT INTO public."cash_settings"')) {
          const old = (await db.query(`SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.prokind='f' AND has_function_privilege('anon',p.oid,'EXECUTE')) AS exposed`)).rows[0];
          assert.equal(old.exposed, true, 'OLD_VERIFIER_FAILURE_NOT_REPRODUCED');
          throw new WriterError('TARGET_BROWSER_ACCESS_EXPOSED');
        }
      };
      await failure(original, 'enums'); fault = undefined;
      checks.managedOwnershipReproduced = true;
      const checkpointCatalog = await readWriterCatalog(session);
      const checkpointHash = writerCatalogHash(checkpointCatalog);
      const oldRun = (await db.query('SELECT * FROM sinegasi_ops.production_reconciliation_runs')).rows[0];
      const resumeClock = clock + 60_000;
      const resume = writerResumeFixture(bundle, original, checkpointCatalog.inventory, checkpointHash, managed.sha256, resumeClock);
      const resumeRun = (chosen = intercepted, authorization = resume) => runReconciliationWriter(chosen, bundle, authorization, () => resumeClock);
      const resumeFailure = async (expected: string, authorization = resume) => {
        await assert.rejects(resumeRun(intercepted, authorization), (error: unknown) => {
          assert.ok(error instanceof WriterError);
          writerFailureStage = error.stage; writerMutation = error.mutation;
          assert.equal(error.stage, expected); return true;
        });
        assert.equal(writerCatalogHash(await readWriterCatalog(session)), checkpointHash);
      };
      stage = 'RESUME_APPROVAL_REVIEW';
      await resumeFailure('ORIGINAL_APPROVAL_CHECKSUM_MISMATCH', { ...resume, originalApprovalRaw: undefined });
      await resumeFailure('ORIGINAL_APPROVAL_CHECKSUM_MISMATCH', { ...resume, originalApprovalRaw: originalRaw + ' ' });
      const unreviewed = JSON.parse(resume.approvalRaw) as Record<string, unknown>;
      delete unreviewed.managedExtensionSha256;
      const unreviewedRaw = JSON.stringify(unreviewed);
      await resumeFailure('MANAGED_EXTENSION_REVIEW_OR_PARITY_REQUIRED', { ...resume,
        approvalRaw: unreviewedRaw, confirmedApprovalSha256: sha256(unreviewedRaw) });
      for (const key of ['approvalSha256', 'releaseSha', 'backupInventorySha256']) {
        const changed = JSON.parse(resume.approvalRaw) as Record<string, unknown>;
        (changed.resumeFrom as Record<string, unknown>)[key] = '0'.repeat(key === 'releaseSha' ? 40 : 64);
        const approvalRaw = JSON.stringify(changed);
        await assert.rejects(resumeRun(intercepted, { ...resume, approvalRaw, confirmedApprovalSha256: sha256(approvalRaw) }));
        assert.equal(writerCatalogHash(await readWriterCatalog(session)), checkpointHash);
      }
      checks.resumeNewApprovalRequired = true;
      const differentBackup = structuredClone(resume.backupInventory); differentBackup.roles = [];
      await resumeFailure('RESUME_FRESH_BACKUP_PARITY_REQUIRED', { ...resume, backupInventory: differentBackup });
      checks.resumeFreshBackupParity = true;
      stage = 'RESUME_ROLLBACK';
      fault = async sql => { if (sql.includes('INSERT INTO public."cash_settings"')) await db.query('SELECT 1/0'); };
      await resumeFailure('WRITER_FAILED_INSPECT_CHECKPOINT'); fault = undefined;
      assert.deepEqual((await db.query('SELECT * FROM sinegasi_ops.production_reconciliation_runs')).rows[0], oldRun);
      checks.resumeRollback = true;
      stage = 'APPLICATION_RPC_ACCESS';
      // Pick an actual reviewed signature rather than hard-coding the application RPC overload.
      fault = async sql => { if (sql.includes('INSERT INTO public."cash_settings"')) await db.query('GRANT EXECUTE ON FUNCTION ' + bundle.snapshot.functions[0].signature + ' TO anon'); };
      await resumeFailure('TARGET_BROWSER_ACCESS_EXPOSED'); fault = undefined;
      checks.applicationRpcExposureRefused = true;
      stage = 'MANAGED_EXTENSION_DRIFT';
      // DDL on a function already used by this transaction waits for its object
      // lock. Introduce real drift BEFORE the writer instead of creating an
      // artificial cross-session wait/idle timeout in the test harness.
      await admin.query('ALTER FUNCTION public.similarity(text,text) SECURITY DEFINER');
      await resumeFailure('UNREVIEWED_MANAGED_EXTENSION_REFUSED');
      await admin.query('ALTER FUNCTION public.similarity(text,text) SECURITY INVOKER');
      assert.equal((await readManagedTrigram(session)).sha256, managed.sha256);
      checks.managedExtensionDriftRefused = true;
      stage = 'EXTENSION_MEMBER_SPOOF';
      await admin.query(`CREATE FUNCTION public.extension_spoof() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1';
        ALTER EXTENSION pg_trgm ADD FUNCTION public.extension_spoof()`);
      await assert.rejects(resumeRun(), (error: unknown) => error instanceof WriterError && error.stage === 'UNREVIEWED_MANAGED_EXTENSION_REFUSED');
      await admin.query('ALTER EXTENSION pg_trgm DROP FUNCTION public.extension_spoof(); DROP FUNCTION public.extension_spoof()');
      assert.equal(writerCatalogHash(await readWriterCatalog(session)), checkpointHash);
      checks.extensionMemberSpoofRefused = true;
      stage = 'MANAGED_RESUME_COMMIT_UNCERTAINTY';
      const uncertain: WriterSession = { ...session, query: async (sql, values) => {
        const result = await session.query(sql, values);
        if (sql === 'COMMIT') throw new Error('SIMULATED_RESUME_COMMIT_RESPONSE_LOSS');
        return result;
      } };
      await assert.rejects(resumeRun(uncertain), (error: unknown) => error instanceof WriterError
        && error.stage === 'COMMIT_UNCERTAIN_INSPECT_HISTORY_BEFORE_RETRY' && error.mutation === 'unknown');
      checks.resumeCommitUncertainty = true;
      const completedRun = (await db.query('SELECT * FROM sinegasi_ops.production_reconciliation_runs')).rows[0];
      for (const key of ['package_sha256', 'approval_sha256', 'release_sha', 'backup_inventory_sha256', 'enums_catalog_sha256', 'applied_at']) {
        assert.deepEqual(completedRun[key], oldRun[key]);
      }
      assert.equal(completedRun.stage, 'complete');
      assert.equal(completedRun.completion_authorization.approvalSha256, resume.confirmedApprovalSha256);
      assert.equal(completedRun.completion_authorization.releaseSha, resume.releaseSha);
      checks.resumeOriginalBindingsPreserved = true;
      await verifyWriterTarget(session, snapshot, bundle.reference, managed.sha256);
      assert.equal((await readManagedTrigram(session)).sha256, managed.sha256);
      checks.managedExtensionResume = true;
      fault = async sql => { assert.doesNotMatch(sql.trim(), /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|GRANT|REVOKE)\b/i); };
      assert.equal((await resumeRun()).mode, 'noop'); fault = undefined;
      checks.resumeRepeatNoop = true;
      await assert.rejects(run(original), (error: unknown) => error instanceof WriterError && error.stage === 'RESUME_COMPLETION_BINDING_MISMATCH');
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const access = (await db.query(`SELECT has_schema_privilege($1,'sinegasi_ops','USAGE') AS usage,
          has_table_privilege($1,'sinegasi_ops.production_reconciliation_runs','SELECT') AS read`, [role])).rows[0];
        assert.equal(access.usage, false); assert.equal(access.read, false);
      }
    } finally { fault = undefined; await admin.end(); }
    assert.ok(WRITER_CHECKS.every(check => checks[check] === true));
    console.log(JSON.stringify({ status: 'RECONCILIATION_WRITER_ISOLATED_PASSED', packageSha256: bundle.packageSha256,
      checks, postgresVersion: marker.version, tables: 73, referenceRows: 213,
      productionChanged: false, devDatabaseChanged: false, productionApproved: false, managedSupabaseIntegrationTested: false }));
  } finally { await db.end().catch(() => {}); }
}
if (require.main === module) void main().catch((error: unknown) => {
  console.log(JSON.stringify({ status: 'WRITER_ISOLATED_TEST_FAILED', stage,
    writerFailureStage, writerMutation,
    check: error instanceof WriterError ? error.stage : error instanceof assert.AssertionError ? 'ASSERTION_FAILED' : 'TEST_FAILED',
    code: typeof error === 'object' && error !== null && 'code' in error && /^[A-Z0-9_]+$/.test(String(error.code)) ? String(error.code) : undefined,
    routine: typeof error === 'object' && error !== null && 'routine' in error && /^[a-zA-Z_]+$/.test(String(error.routine)) ? String(error.routine) : undefined,
    productionChanged: false }));
});
