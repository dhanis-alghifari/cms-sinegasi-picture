import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { bootstrapFirstTeacher, type BootstrapTeacherCredential } from './bootstrapTeacherCore.js';
import { verifyPassword } from '../services/passwordService.js';
import { databaseInventory } from './productionBackupCore.js';
import { compileReconciliation, sha256, validateSnapshot } from './productionReconciliation.js';
import { createReferenceDataPlan, parseReferencePlanArguments, rehearseReferenceData, type ReferenceDatabase } from './productionReferenceData.js';

let stage = 'INITIALIZATION';
function client(database = 'sinegasi_schema_fresh'): pg.Client {
  const db = new pg.Client({ host: '127.0.0.1', port: 5432, user: 'postgres', database,
    connectionTimeoutMillis: 3000, query_timeout: 30_000 });
  db.on('error', () => {});
  return db;
}
function adapter(db: pg.Client): ReferenceDatabase {
  return { query: (sql, values) => db.query(sql, values ? [...values] : undefined) };
}
async function main(): Promise<void> {
  if (process.argv[2] !== 'isolated-reference') throw new Error('ISOLATED_MODE_REQUIRED');
  const amount = parseReferencePlanArguments(['plan', ...process.argv.slice(3)]);
  if (amount === null) throw new Error('EXPLICIT_BILLING_AMOUNT_REQUIRED');
  const snapshot: unknown = JSON.parse(await readFile(resolve(__dirname, '../production-schema.snapshot.json'), 'utf8'));
  validateSnapshot(snapshot);
  const fingerprint = sha256(compileReconciliation(snapshot).join('\n'));
  const plan = createReferenceDataPlan(snapshot, fingerprint, amount);
  const db = client(); await db.connect();
  const database = adapter(db);
  const run = (connection = database) => rehearseReferenceData(connection, snapshot, fingerprint, amount, plan.checksum);
  try {
    stage = 'EMPTY_SCHEMA_REQUIRED';
    const before = await databaseInventory(db);
    assert.equal(before.tables.length, 73);
    assert.ok(before.tables.every(table => table.rows === '0' && table.rls));
    stage = 'REFERENCE_ROLLBACK';
    for (const fragment of ['INSERT INTO public."work_types"', 'INSERT INTO sinegasi_ops.reference_data_history']) {
      await assert.rejects(run({ async query(sql, values) {
        if (sql.includes(fragment)) await db.query('SELECT 1/0');
        return database.query(sql, values);
      } }), { code: 'REFERENCE_REHEARSAL_FAILED' });
      assert.deepEqual(await databaseInventory(db), before);
      assert.equal((await db.query("SELECT to_regclass('sinegasi_ops.reference_data_history') AS history")).rows[0].history, null);
    }
    stage = 'REFERENCE_CONCURRENCY';
    const contender = client(); await contender.connect();
    try {
      await contender.query("SELECT pg_advisory_lock(hashtext('sinegasi:schema-migrations'))");
      await assert.rejects(run(), { code: 'REFERENCE_CONCURRENT_RUNNER_REFUSED' });
    } finally { await contender.end(); }
    stage = 'REFERENCE_NONEMPTY';
    await db.query("INSERT INTO public.api_idempotency_responses(cache_key,status_code,payload,expires_at) VALUES('reference-fixture',200,'{}',now())");
    await assert.rejects(run(), { code: 'REFERENCE_NONEMPTY_DATABASE_REFUSED' });
    await db.query("DELETE FROM public.api_idempotency_responses WHERE cache_key='reference-fixture'");
    stage = 'REFERENCE_APPLY';
    assert.equal((await run()).mode, 'applied');
    const after = await databaseInventory(db);
    const referenceNames = new Set(plan.tables.map(table => table.name));
    assert.ok(after.tables.filter(table => !referenceNames.has(table.name)).every(table => table.rows === '0'));
    assert.equal((await run()).mode, 'noop');
    assert.deepEqual(await databaseInventory(db), after);
    stage = 'REFERENCE_DRIFT';
    await assert.rejects(rehearseReferenceData(database, snapshot, fingerprint, amount + 1,
      createReferenceDataPlan(snapshot, fingerprint, amount + 1).checksum), { code: 'REFERENCE_RECEIPT_CHECKSUM_MISMATCH' });
    await db.query("UPDATE public.work_types SET label='Changed fixture' WHERE code='short_film'");
    await assert.rejects(run(), { code: 'REFERENCE_DATA_DRIFT' });
    await db.query("UPDATE public.work_types SET label='Film Pendek' WHERE code='short_film'");
    stage = 'REFERENCE_BROWSER_DENIED';
    for (const role of ['anon', 'authenticated']) {
      await db.query('BEGIN'); await db.query(`SET LOCAL ROLE ${role}`);
      try { await assert.rejects(db.query('SELECT * FROM public.access_role_permissions'), (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === '42501'); }
      finally { await db.query('ROLLBACK'); }
    }
    await db.query('BEGIN'); await db.query('SET LOCAL ROLE service_role');
    const billing = (await db.query('SELECT nominal_iuran_wajib,skip_week FROM public.cash_settings')).rows[0];
    assert.equal(Number(billing.nominal_iuran_wajib), amount); assert.equal(billing.skip_week, true);
    const teacher = await db.query("SELECT permission_key FROM public.access_role_permissions WHERE role_key='teacher'");
    assert.ok(['users.manage', 'access_control.manage'].every(key => teacher.rows.some(row => row.permission_key === key)));
    await assert.rejects(db.query('SELECT * FROM sinegasi_ops.reference_data_history'), (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '42501');
    await db.query('ROLLBACK');
    stage = 'BOOTSTRAP_FIXTURE';
    // Credentials remain in process memory only; never print, persist or transfer this test password.
    let credential: BootstrapTeacherCredential | undefined;
    await bootstrapFirstTeacher({ projectRef: snapshot.targetProject, confirmProject: snapshot.targetProject,
      username: 'admin', nama: 'Guru Rehearsal Fixture', apply: true }, {
      database, credentials: { async create(value) {
        credential = value; return { async remove() { credential = undefined; } };
      } },
    });
    assert.ok(credential);
    const users = await db.query('SELECT username,role,is_first_login,auth_version,password_hash FROM public.users');
    assert.equal(users.rows.length, 1);
    const user = users.rows[0];
    assert.equal(user.username, 'admin'); assert.equal(user.role, 'teacher');
    assert.equal(user.is_first_login, true); assert.equal(user.auth_version, 1);
    assert.equal((await verifyPassword(credential.temporaryPassword, user.password_hash)).valid, true);
    credential.temporaryPassword = ''; credential = undefined;
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.students')).rows[0].count, 0);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.cash_transactions')).rows[0].count, 0);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.schema_migrations')).rows[0].count, 0);
    console.log(JSON.stringify({ status: 'REFERENCE_DATA_REHEARSAL_PASSED', schemaPackageSha256: fingerprint,
      referenceChecksum: plan.checksum, billingAmount: amount, referenceRows: plan.tables.reduce((sum, table) => sum + table.rows.length, 0),
      checks: { emptyBusinessTablesBeforeBootstrap: true, referenceRowsAndReceiptRollback: true,
        concurrentRunnerRefused: true, nonemptyRefused: true, repeatIsVerifiedNoop: true,
        changedReceiptAndDataRefused: true, browserDenied: true, serviceRoleConfigurationRead: true,
        privateReceiptDenied: true, fixtureTeacherScryptAndForcedPasswordChange: true, bootstrapCanonicalAudit: true },
      productionChanged: false, devDatabaseChanged: false, productionApproved: false,
      applicationFlowTestsPassed: false, managedSupabaseIntegrationTested: false, liveAccountCreated: false }));
  } finally { await db.end(); }
}
if (require.main === module) void main().catch(() => {
  console.log(JSON.stringify({ status: 'REFERENCE_DATA_REHEARSAL_FAILED', stage, productionChanged: false }));
  process.exitCode = 1;
});
