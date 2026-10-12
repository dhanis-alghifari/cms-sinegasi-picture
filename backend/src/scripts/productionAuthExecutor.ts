import { randomBytes } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { AUTH_ACCOUNT, AUTH_BOOTSTRAP_RECEIPT, AUTH_BOOTSTRAP_RECEIPT_SHA, AUTH_CUSTODY_FILE, AUTH_PRIVATE_ROOT,
  AUTH_TEMPORARY_FILE, authRecord, authRequire, AuthExecutorError, MANAGED_AUTH_CHECKS, parseAuthExecutorCommand,
  requireAuthWindow, validateAuthApproval, validateAuthEvidence, type AuthExecutorBindings } from './productionAuthExecutorCore.js';
import { createIsolatedAuthTransport, createManagedAuthTransport, type AuthTransport } from './productionAuthTransport.js';
import { runManagedAuthFlow } from './productionAuthManagedFlow.js';
import { persistAuthCustody } from './productionAuthCustody.js';
import { readAuthBaseline, requireRotatedPassword } from './productionAuthBaseline.js';
import { AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_USER_ID, createAuthAcceptanceFixture } from './authAcceptanceFixture.js';
import { rehearseExecutorGuards, requireExecutorFixturePostcondition } from './productionAuthExecutorRehearsal.js';
import { BACKUP_HOST, BACKUP_PROJECT, databaseInventory, privateCommand, readGithubQualityMetadata, readKeychain,
  validateBackupCa, validateBackupTarget } from './productionBackupCore.js';
import { INTEGRATION_ORIGIN, INTEGRATION_SERVICE_KEY, validateIntegrationKey } from './productionManagedIntegrationCore.js';
import { sha256, verifyCandidateFiles } from './productionReconciliation.js';
import { privateJson, requireWriterReleaseSha, verifiedBackupInventory } from './reconciliationWriter.js';
import { createWriterPackage, requireWriterQualityRun } from './reconciliationWriterPolicy.js';
import type { WriterSession } from './reconciliationWriterCatalog.js';
import { verifyPassword } from '../services/passwordService.js';

export async function authExecutorSourceHash(repository: string): Promise<string> {
  // All current backend sources/tests, not just the entry point. Never .env, dumps or credentials.
  const source = resolve(repository, 'backend/src');
  const files = (await readdir(source, { recursive: true })).filter(file => file.endsWith('.ts')).map(file => 'backend/src/' + file);
  files.push('backend/package.json', 'backend/package-lock.json', 'backend/tsconfig.json', '.github/workflows/quality.yml',
    'ops/production-schema.snapshot.json');
  for (const file of files.sort()) {
    const stat = await lstat(resolve(repository, file)); authRequire(stat.isFile() && !stat.isSymbolicLink(), 'AUTH_SOURCE_SYMLINK_REFUSED');
  }
  return sha256(JSON.stringify(await Promise.all(files.map(async file => [file, sha256(await readFile(resolve(repository, file)))]))));
}
async function isolatedApplication(origin: string, key: string, transport: AuthTransport): Promise<FastifyInstance> {
  authRequire(!Object.keys(require.cache).some(file => /\/(?:config\/env|services\/supabaseClient|app\/createApplication)\.(?:ts|js)$/.test(file)),
    'AUTH_EXECUTOR_FRESH_PROCESS_REQUIRED');
  Object.assign(process.env, { NODE_ENV: 'production', PUBLIC_DEPLOYMENT: 'true', ALLOW_DEV_AUTH: 'false',
    BACKGROUND_JOBS_ENABLED: 'false', NTFY_ENABLED: 'false', NTFY_ACCESS_TOKEN: '', DATABASE_URL: '',
    CORS_ORIGINS: 'https://localhost', HOST: '127.0.0.1', TRUST_PROXY: 'false', JWT_SECRET: randomBytes(48).toString('base64url'),
    SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key, CLOUDFLARE_R2_ACCOUNT_ID: '', R2_ACCOUNT_ID: '',
    CLOUDFLARE_R2_BUCKET_NAME: '', R2_BUCKET_NAME: '', CLOUDFLARE_R2_PUBLIC_DOMAIN: '', R2_PUBLIC_DOMAIN: '',
    CLOUDFLARE_R2_ACCESS_KEY_ID: '', R2_ACCESS_KEY_ID: '', CLOUDFLARE_R2_SECRET_ACCESS_KEY: '', R2_SECRET_ACCESS_KEY: '' });
  globalThis.fetch = transport.fetch;
  const { runtimeConfig } = await import('../config/env.js');
  authRequire(runtimeConfig.publicDeployment && !runtimeConfig.allowDevelopmentAuth && !runtimeConfig.backgroundJobsEnabled
    && !runtimeConfig.ntfyEnabled && !runtimeConfig.databaseUrl && runtimeConfig.supabaseUrl === origin
    && runtimeConfig.supabaseServiceRoleKey === key, 'AUTH_EXECUTOR_RUNTIME_GUARDS');
  const { createApplication } = await import('../app/createApplication.js');
  const runtime = await createApplication(); runtime.app.log.level = 'silent'; return runtime.app;
}
let activeTransport: AuthTransport | undefined;
let custodyPersisted = false;
let custodyAttempted = false;
export function authExecutorFailure(error: unknown): Record<string, unknown> {
  const observations = activeTransport?.observations;
  let passwordChanged: boolean | 'unknown' = false;
  if (observations?.rotationOutcome === 'acknowledged') passwordChanged = true;
  else if (observations?.rotationAttempts) passwordChanged = 'unknown';
  let preserved: boolean | 'unknown' = false;
  if (custodyPersisted) preserved = true;
  else if (custodyAttempted) preserved = 'unknown';
  return { status: 'STOP', stage: error instanceof AuthExecutorError ? error.stage : 'AUTH_EXECUTOR_STOPPED',
    productionChanged: observations?.writesAttempted ? 'unknown' : false,
    productionPasswordChanged: passwordChanged, privateCustodyPreserved: preserved,
    automaticRetryAllowed: false, inspectBeforeRetry: custodyAttempted,
    deploymentPerformed: false, readyForPublicLaunch: false };
}

export async function mainAuthExecutor(args = process.argv.slice(2)): Promise<void> {
  const command = parseAuthExecutorCommand(args);
  authRequire(process.env.ENV_FILE_LOADING === 'disabled', 'ENV_FILE_LOADING_MUST_BE_DISABLED');
  authRequire(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'AUTH_TLS_VERIFICATION_REQUIRED');
  const repository = resolve(__dirname, '../../..');
  const { snapshot } = await verifyCandidateFiles(repository), bundle = createWriterPackage(snapshot);
  const bindings: AuthExecutorBindings = { releaseSha: await requireWriterReleaseSha(repository, false),
    runnerSourceSha256: await authExecutorSourceHash(repository), packageSha256: bundle.packageSha256 };
  const workingTreeDirty = Boolean((await privateCommand('/usr/bin/git', ['-C', repository, 'status', '--porcelain'])).trim());
  if (command.mode === 'plan') {
    console.log(JSON.stringify({ status: 'PRODUCTION_AUTH_EXECUTOR_OFFLINE_PLAN', project: BACKUP_PROJECT, ...AUTH_ACCOUNT, ...bindings,
      workingTreeDirty, managedChecks: MANAGED_AUTH_CHECKS, productionExecutionImplemented: true, productionExecutionApproved: false,
      keychainServicesForFutureApply: ['sinegasi-prod-backup-age-identity', 'sinegasi-prod-postgres-admin-url', INTEGRATION_SERVICE_KEY],
      custodyFile: AUTH_CUSTODY_FILE, oldApprovalReusable: false, keychainAccessed: false, credentialFileRead: false,
      databaseAccessed: false, networkAccessed: false, productionChanged: false, deploymentPerformed: false, readyForPublicLaunch: false })); return;
  }
  const originalFetch = globalThis.fetch;
  let app: FastifyInstance | undefined;
  if (command.mode === 'rehearse') {
    const fixture = await createAuthAcceptanceFixture();
    let stored = false;
    const transport = createIsolatedAuthTransport({ origin: AUTH_FIXTURE_ORIGIN, key: AUTH_FIXTURE_KEY, userId: AUTH_FIXTURE_USER_ID,
      username: 'fixture_guru', newPassword: fixture.newPassword, deadline: Date.now() + 5 * 60_000,
      beforeRequest() { authRequire(stored, 'AUTH_CUSTODY_REQUIRED_BEFORE_REQUEST'); } }, fixture.fetch);
    try {
      app = await isolatedApplication(AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_KEY, transport);
      const guardChecks = await rehearseExecutorGuards(app, fixture);
      const checks = await runManagedAuthFlow(app, { account: { userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', nama: 'Guru Terisolasi', role: 'teacher' },
        temporaryPassword: fixture.temporaryPassword, newPassword: fixture.newPassword, transport,
        persistCustody: async () => { authRequire(!stored, 'AUTH_FIXTURE_CUSTODY_REPEAT'); stored = true; }, beforeRotation: async () => {},
        verifyPostcondition: async () => { requireExecutorFixturePostcondition(fixture); } });
      console.log(JSON.stringify({ status: 'ISOLATED_AUTH_EXECUTOR_PASSED', project: BACKUP_PROJECT, ...bindings, workingTreeDirty,
        observedAt: new Date().toISOString(), checks, guardChecks, requests: transport.observations, fixture: fixture.snapshot(),
        realFastifyAuthRoutesTested: true, restStoreEmulated: true, databaseAtomicityTested: false, managedSupabaseIntegrationTested: false,
        productionLoginTested: false, productionPasswordChanged: false, keychainAccessed: false, credentialFileRead: false,
        networkAccessed: false, workersStarted: false, productionChanged: false, deploymentPerformed: false, readyForPublicLaunch: false }));
    } finally { await app?.close(); globalThis.fetch = originalFetch; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.JWT_SECRET; }
    return;
  }
  authRequire(process.platform === 'darwin', 'AUTH_MANAGED_EXECUTION_REQUIRES_MAC'); process.umask(0o077);
  let approval: ReturnType<typeof validateAuthApproval> | undefined;
  let backupInventory: Awaited<ReturnType<typeof verifiedBackupInventory>> | undefined;
  if (command.mode === 'apply') {
    const raw = await privateJson(command.approval);
    approval = validateAuthApproval(raw, command.checksum, bindings, Date.now());
    // Existing account-wide attempt is terminal, even with a new checksum.
    try { await lstat(AUTH_CUSTODY_FILE); throw new AuthExecutorError('AUTH_PREVIOUS_ATTEMPT_REQUIRES_READONLY_RECONCILIATION'); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    validateAuthEvidence(approval, { bootstrap: await privateJson(AUTH_PRIVATE_ROOT + '/' + AUTH_BOOTSTRAP_RECEIPT),
      recovery: await privateJson(AUTH_PRIVATE_ROOT + '/' + approval.recoveryEvidenceFile),
      baseline: await privateJson(AUTH_PRIVATE_ROOT + '/' + approval.baselineEvidenceFile),
      rehearsal: await privateJson(AUTH_PRIVATE_ROOT + '/' + approval.rehearsalEvidenceFile) }, Date.now());
    await requireWriterReleaseSha(repository, true);
    const quality = await readGithubQualityMetadata(approval.qualityRunId); requireWriterQualityRun(quality.run, quality.jobs, bindings.releaseSha);
    console.log(JSON.stringify({ stage: 'AUTH_RECOVERY_KEYCHAIN_READY', service: 'sinegasi-prod-backup-age-identity', productionChanged: false }));
    backupInventory = await verifiedBackupInventory(approval.backupId, await privateJson(AUTH_PRIVATE_ROOT + '/' + approval.recoveryEvidenceFile));
  }
  authRequire(sha256(await privateJson(AUTH_PRIVATE_ROOT + '/' + AUTH_BOOTSTRAP_RECEIPT)) === AUTH_BOOTSTRAP_RECEIPT_SHA,
    'AUTH_BOOTSTRAP_RECEIPT_CHANGED');
  const ca = await readFile('/Users/memberid/Downloads/prod-ca-2021.crt', 'utf8'); validateBackupCa(ca);
  console.log(JSON.stringify({ stage: 'AUTH_ADMIN_KEYCHAIN_READY', service: 'sinegasi-prod-postgres-admin-url', readOnly: true, productionChanged: false }));
  const target = validateBackupTarget(await readKeychain('sinegasi-prod-postgres-admin-url', 'postgres'));
  const client = new pg.Client({ host: BACKUP_HOST, port: 5432, database: 'postgres', user: target.user, password: target.password,
    ssl: { ca, rejectUnauthorized: true, servername: BACKUP_HOST }, connectionTimeoutMillis: 12000, query_timeout: 30_000,
    application_name: 'sinegasi-reviewed-auth-readonly', options: '-c default_transaction_read_only=on' });
  client.on('error', () => {});
  let locked = false;
  const db: WriterSession = { query: (sql, values) => client.query(sql, values ? [...values] : undefined), inventory: () => databaseInventory(client) };
  const observe = async (rotated = false, allowCounterWrites = false) => {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      await client.query("SET LOCAL search_path=pg_catalog,public,extensions; SET LOCAL statement_timeout='10s'");
      const identity = (await client.query("SELECT current_database() AS db,current_user AS actor,current_setting('transaction_read_only') AS ro")).rows[0];
      authRequire(identity?.db === 'postgres' && identity.actor === 'postgres' && identity.ro === 'on', 'AUTH_READONLY_IDENTITY_REQUIRED');
      return await readAuthBaseline(db, bundle, rotated, allowCounterWrites);
    } finally { await client.query('ROLLBACK'); }
  };
  try {
    await client.connect(); target.password = '';
    if (command.mode === 'apply') {
      locked = (await client.query("SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired")).rows[0]?.acquired === true;
      authRequire(locked, 'AUTH_CONCURRENT_MAINTENANCE_REFUSED');
    }
    const state = (await client.query('SELECT auth_version FROM public.users WHERE id=$1', [AUTH_ACCOUNT.userId])).rows[0];
    const rotated = state?.auth_version === 2;
    let previousAttempt = false;
    if (command.mode === 'inspect') {
      try { await lstat(AUTH_CUSTODY_FILE); previousAttempt = true; }
      catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const before = await observe(rotated, previousAttempt);
    if (command.mode === 'inspect') {
      let status = 'PRODUCTION_AUTH_POST_BOOTSTRAP_BASELINE';
      if (rotated) status = 'PRODUCTION_AUTH_ROTATION_OBSERVED';
      else if (previousAttempt) status = 'PRODUCTION_AUTH_PREVIOUS_ATTEMPT_OBSERVED';
      const receipt = { status, project: BACKUP_PROJECT,
        ...bindings, ...before.baseline, observedAt: new Date().toISOString(), workingTreeDirty, accountStateVerified: true,
        previousAttempt, automaticRetryAllowed: false, keychainAccessed: true, credentialFileRead: false,
        productionChanged: false, deploymentPerformed: false, readyForPublicLaunch: false };
      const file = AUTH_PRIVATE_ROOT + '/production-auth.baseline.' + receipt.observedAt.replace(/[:.]/g, '-') + '.json';
      await persistAuthCustody(file, receipt); console.log(JSON.stringify({ ...receipt, evidenceFile: file })); return;
    }
    authRequire(approval && backupInventory && !rotated, 'AUTH_FIRST_ROTATION_ONLY');
    authRequire(JSON.stringify(before.baseline) === JSON.stringify({ catalogSha256: approval.catalogSha256, inventorySha256: approval.inventorySha256,
      accountAuditSha256: approval.accountAuditSha256, managedExtensionSha256: approval.managedExtensionSha256,
      targetCatalogSha256: approval.targetCatalogSha256, migrationApprovalSha256: approval.migrationApprovalSha256 })
      && sha256(JSON.stringify(backupInventory)) === approval.inventorySha256, 'AUTH_LIVE_BASELINE_OR_BACKUP_DRIFT');
    const a = approval;
    const recheck = async () => {
      requireAuthWindow(a, Date.now());
      authRequire(await requireWriterReleaseSha(repository, true) === bindings.releaseSha
        && await authExecutorSourceHash(repository) === bindings.runnerSourceSha256, 'AUTH_RELEASE_OR_SOURCE_CHANGED');
    };
    await recheck();
    const temporary = authRecord(JSON.parse(await privateJson(AUTH_TEMPORARY_FILE)) as unknown);
    authRequire(temporary.version === 1 && temporary.projectRef === BACKUP_PROJECT && temporary.userId === AUTH_ACCOUNT.userId
      && temporary.username === AUTH_ACCOUNT.username && temporary.nama === AUTH_ACCOUNT.nama && temporary.role === 'teacher'
      && temporary.isFirstLogin === true && typeof temporary.temporaryPassword === 'string'
      && temporary.temporaryPassword.length <= 128 && typeof before.user.password_hash === 'string'
      && (await verifyPassword(temporary.temporaryPassword, before.user.password_hash)).valid, 'AUTH_OFFICIAL_TEMPORARY_CREDENTIAL_REQUIRED');
    const oldPassword = temporary.temporaryPassword, newPassword = `Guru-${randomBytes(32).toString('base64url')}-2`;
    console.log(JSON.stringify({ stage: 'AUTH_SERVICE_KEYCHAIN_READY', service: INTEGRATION_SERVICE_KEY,
      passwordCustodyFile: AUTH_CUSTODY_FILE, productionChanged: false }));
    const key = validateIntegrationKey(await readKeychain(INTEGRATION_SERVICE_KEY, BACKUP_PROJECT), 'service_role');
    const transport = createManagedAuthTransport(key, newPassword, Math.min(Date.parse(a.windowEnd), Date.now() + 5 * 60_000), () => {
      requireAuthWindow(a, Date.now()); authRequire(custodyPersisted, 'AUTH_DURABLE_CUSTODY_REQUIRED');
    }, originalFetch); activeTransport = transport;
    app = await isolatedApplication(INTEGRATION_ORIGIN, key, transport);
    const checks = await runManagedAuthFlow(app, { account: AUTH_ACCOUNT, temporaryPassword: oldPassword, newPassword, transport,
      persistCustody: async () => {
        custodyAttempted = true;
        await persistAuthCustody(AUTH_CUSTODY_FILE, { format: 1, operation: 'first_teacher_auth_acceptance', project: BACKUP_PROJECT,
          ...AUTH_ACCOUNT, approvalSha256: command.checksum, ...bindings, createdAt: new Date().toISOString(),
          newPassword, executionState: 'prepared-outcome-must-be-inspected', automaticRetryAllowed: false }); custodyPersisted = true;
      }, beforeRotation: async () => {
        await recheck(); const latest = await observe(false, true);
        // Rate counters may have changed through the approved login; account, audit and schema may not.
        authRequire(latest.baseline.accountAuditSha256 === before.baseline.accountAuditSha256
          && latest.baseline.managedExtensionSha256 === before.baseline.managedExtensionSha256, 'AUTH_ACCOUNT_CHANGED_BEFORE_ROTATION');
      }, verifyPostcondition: async () => {
        const after = await observe(true); await requireRotatedPassword(after.user, oldPassword, newPassword);
        authRequire(after.bootstrapAuditSha256 === before.bootstrapAuditSha256
          && after.baseline.managedExtensionSha256 === before.baseline.managedExtensionSha256, 'AUTH_BOOTSTRAP_AUDIT_OR_EXTENSION_CHANGED');
        const counters = (await client.query(`SELECT rate_key FROM public.api_login_rate_limits UNION ALL
          SELECT rate_key FROM public.api_rate_limit_windows`)).rows;
        authRequire(counters.every(row => [...transport.counterKeys.login, ...transport.counterKeys.api].includes(String(row.rate_key))),
          'AUTH_UNREVIEWED_COUNTER_ROWS');
        const immutable = (u: Record<string, unknown>) => Object.fromEntries(Object.entries(u).filter(([name]) =>
          !['password_hash', 'auth_version', 'is_first_login', 'updated_at', 'updated_by'].includes(name)));
        authRequire(JSON.stringify(immutable(after.user)) === JSON.stringify(immutable(before.user))
          && after.user.updated_by === AUTH_ACCOUNT.userId, 'AUTH_UNEXPECTED_USER_CHANGE');
      } });
    const result = { status: 'MANAGED_FIRST_TEACHER_AUTH_ACCEPTANCE_PASSED', project: BACKUP_PROJECT, ...AUTH_ACCOUNT, ...bindings,
      approvalSha256: command.checksum, observedAt: new Date().toISOString(), checks, requests: transport.observations,
      productionChanged: true, productionPasswordChanged: true, credentialFile: AUTH_CUSTODY_FILE,
      uiBrowserFlowTested: false, crossWorkerRevocationTested: false, logoutServerRevocationImplemented: false,
      workersStarted: false, deploymentPerformed: false, readyForPublicLaunch: false };
    await app.close(); app = undefined;
    await persistAuthCustody(AUTH_PRIVATE_ROOT + '/production-auth.result.' + result.observedAt.replace(/[:.]/g, '-') + '.json', result);
    console.log(JSON.stringify(result));
  } finally {
    await app?.close(); globalThis.fetch = originalFetch; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.JWT_SECRET;
    if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations'))").catch(() => {});
    target.password = ''; await client.end().catch(() => {});
  }
}
if (require.main === module) void mainAuthExecutor().catch((error: unknown) => {
  console.error(JSON.stringify(authExecutorFailure(error))); process.exitCode = 1;
});
