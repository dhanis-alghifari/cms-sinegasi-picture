import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { BootstrapTeacherError } from './bootstrapTeacherCore.js';
import { privateBootstrapCredentialStore } from './bootstrapTeacherCredentials.js';
import { bootstrapApprovedProductionTeacher, BOOTSTRAP_GUARD_CHECKS,
  requireCompletedBootstrapCheckpoint } from './productionBootstrapTeacherCore.js';
import { bootstrapFixtureAuthorization } from './productionBootstrapTeacherFixtures.js';
import { readWriterCatalog, type WriterSession } from './reconciliationWriterCatalog.js';
import { readManagedTrigram } from './reconciliationWriterExtensions.js';
import type { WriterPackage } from './reconciliationWriterPolicy.js';

/** Only called by the isolated writer harness after it has completed a real
 * migration/resume. No connection options, production override or Keychain. */
export interface BootstrapFixtureReceipt {
  status: 'BOOTSTRAP_GUARD_ISOLATED_PASSED';
  packageSha256: string;
  checks: Partial<Record<typeof BOOTSTRAP_GUARD_CHECKS[number], boolean>>;
  productionChanged: false;
  devDatabaseChanged: false;
  productionApproved: false;
  managedSupabaseIntegrationTested: false;
}
export async function verifyProductionBootstrapFixture(db: WriterSession, bundle: WriterPackage, now: number,
  resetDisposable: () => Promise<void>): Promise<BootstrapFixtureReceipt> {
  assert.equal((await db.query("SELECT current_setting('sinegasi.schema_rehearsal',true) AS marker")).rows[0]?.marker, 'on');
  const checkpoint = await requireCompletedBootstrapCheckpoint(db, bundle);
  const managed = await readManagedTrigram(db);
  let auth = bootstrapFixtureAuthorization(bundle, await readWriterCatalog(db), checkpoint.migrationApprovalSha256, managed.sha256, now);
  const checks: Partial<Record<typeof BOOTSTRAP_GUARD_CHECKS[number], boolean>> = {};
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), 'bootstrap-guard-fixture-'));
  await chmod(directory, 0o700);
  const file = path.join(directory, 'teacher.json');
  const credentials = privateBootstrapCredentialStore(file);
  const run = (chosen = db, authorization = auth) => bootstrapApprovedProductionTeacher(chosen, credentials, bundle, authorization, () => now);
  const absent = () => assert.rejects(lstat(file), { code: 'ENOENT' });
  const refusal = async (chosen = db, authorization = auth) => {
    await assert.rejects(run(chosen, authorization));
    await absent();
    assert.equal((await db.query('SELECT count(*)::text AS count FROM public.users')).rows[0].count, '0');
  };
  try {
    checks.completedCheckpoint = true;
    await db.query("UPDATE sinegasi_ops.production_reconciliation_runs SET stage='enums'");
    await refusal();
    await db.query("UPDATE sinegasi_ops.production_reconciliation_runs SET stage='complete'");
    checks.enumOnlyRefused = true;
    await db.query('UPDATE public.cash_settings SET nominal_iuran_wajib=6000');
    await refusal();
    await db.query('UPDATE public.cash_settings SET nominal_iuran_wajib=5000');
    checks.catalogDriftRefused = true;
    await refusal(db, { ...auth, backupInventory: { ...auth.backupInventory, roles: [] } });
    checks.backupParityRefused = true;
    await db.query('GRANT SELECT ON sinegasi_ops.production_reconciliation_runs TO anon');
    await refusal();
    await db.query('REVOKE SELECT ON sinegasi_ops.production_reconciliation_runs FROM anon');
    checks.privateHistoryDenied = true;
    const contender = new pg.Client({ host: '127.0.0.1', port: 5432, database: 'postgres', user: 'postgres', connectionTimeoutMillis: 3000 });
    await contender.connect();
    try {
      await contender.query("SELECT pg_advisory_lock(hashtext('sinegasi:schema-migrations'))");
      await refusal(); checks.concurrentWriterRefused = true;
    } finally { await contender.end(); }
    const failing: WriterSession = { ...db, async query(sql, values) {
      if (sql.includes('SELECT public.write_audit_log')) throw new Error('SYNTHETIC_PRECOMMIT_FAILURE');
      return db.query(sql, values);
    } };
    await refusal(failing); checks.rollbackBeforeCommit = true;
    const result = await run();
    assert.equal(result.mode, 'applied');
    assert.equal((await lstat(file)).mode & 0o777, 0o600);
    const account = (await db.query('SELECT role,is_first_login,is_active,auth_version FROM public.users')).rows;
    assert.deepEqual(account, [{ role: 'teacher', is_first_login: true, is_active: true, auth_version: 1 }]);
    assert.equal((await db.query("SELECT count(*)::text AS count FROM public.activity_logs WHERE source='bootstrap' AND new_values->>'password_hash' IS NULL")).rows[0].count, '1');
    checks.oneTeacherCanonicalAudit = true;
    await assert.rejects(run());
    assert.equal((await db.query('SELECT count(*)::text AS count FROM public.users')).rows[0].count, '1');
    checks.repeatRefused = true;
    // Audit records are append-only. Rebuild the marked fixture schemas using
    // the harness, rather than bypassing retention or deleting account audits.
    assert.equal((await db.query("SELECT current_setting('sinegasi.schema_rehearsal',true) AS marker")).rows[0]?.marker, 'on');
    await resetDisposable();
    await rm(file);
    const fresh = await requireCompletedBootstrapCheckpoint(db, bundle);
    auth = bootstrapFixtureAuthorization(bundle, await readWriterCatalog(db), fresh.migrationApprovalSha256,
      (await readManagedTrigram(db)).sha256, now);
    const uncertain: WriterSession = { ...db, async query(sql, values) {
      const response = await db.query(sql, values);
      if (sql === 'COMMIT') throw new Error('SYNTHETIC_COMMIT_ACK_LOST');
      return response;
    } };
    await assert.rejects(run(uncertain), (error: unknown) => error instanceof BootstrapTeacherError
      && error.code === 'BOOTSTRAP_COMMIT_UNCERTAIN_CREDENTIAL_FILE_PRESERVED');
    assert.equal((await lstat(file)).mode & 0o777, 0o600);
    assert.equal((await db.query('SELECT count(*)::text AS count FROM public.users')).rows[0].count, '1');
    checks.commitUncertaintyPreservesCredentials = true;
    assert.ok(BOOTSTRAP_GUARD_CHECKS.every(key => checks[key] === true));
    return { status: 'BOOTSTRAP_GUARD_ISOLATED_PASSED', packageSha256: bundle.packageSha256, checks,
      productionChanged: false, devDatabaseChanged: false, productionApproved: false, managedSupabaseIntegrationTested: false };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
