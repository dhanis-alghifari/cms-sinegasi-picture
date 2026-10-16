import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_USER_ID, createAuthAcceptanceFixture } from './authAcceptanceFixture.js';
import { AUTH_VERIFICATION_CHECKS, runAuthVerificationFlow } from './authVerificationFlow.js';
import { readAuthBaseline } from './productionAuthBaseline.js';
import { persistAuthCustody } from './productionAuthCustody.js';
import { authExecutorSourceHash } from './productionAuthExecutor.js';
import { AUTH_ACCOUNT, AUTH_BOOTSTRAP_RECEIPT, AUTH_BOOTSTRAP_RECEIPT_SHA, AUTH_CUSTODY_FILE, AUTH_PRIVATE_ROOT,
  AUTH_TEMPORARY_FILE, authRequire, AuthExecutorError, type AuthBaseline, type AuthExecutorBindings } from './productionAuthExecutorCore.js';
import { createIsolatedAuthVerificationTransport, createManagedAuthVerificationTransport, type AuthVerificationTransport } from './productionAuthTransport.js';
import { AUTH_ROTATION_APPROVAL_SHA, AUTH_VERIFICATION_ATTEMPT_FILE, AUTH_VERIFICATION_GUARDS, parseVerificationCommand,
  readVerificationCredentialDocuments, requireVerificationCredentialMatch, requireVerificationUnchanged, requireVerificationWindow,
  validateVerificationApproval, validateVerificationEvidence, type VerificationApproval, type VerificationCredentials } from './productionAuthVerificationCore.js';
import { persistVerificationAttempt, requireNoVerificationAttempt } from './productionAuthVerificationAttempt.js';
import { rehearseVerificationExecutorGuards } from './productionAuthVerificationExecutorRehearsal.js';
import { BACKUP_HOST, BACKUP_PROJECT, databaseInventory, privateCommand, readGithubQualityMetadata, readKeychain,
  validateBackupCa, validateBackupTarget } from './productionBackupCore.js';
import { INTEGRATION_ORIGIN, INTEGRATION_SERVICE_KEY, validateIntegrationKey } from './productionManagedIntegrationCore.js';
import { sha256, verifyCandidateFiles } from './productionReconciliation.js';
import { privateJson, requireWriterReleaseSha, verifiedBackupInventory } from './reconciliationWriter.js';
import type { WriterSession } from './reconciliationWriterCatalog.js';
import { createWriterPackage, requireWriterQualityRun } from './reconciliationWriterPolicy.js';

interface VerificationExecutionState {
  managed: boolean; attemptStarted: boolean; attemptPersisted: boolean;
  accountUnchangedVerified: boolean; transport?: AuthVerificationTransport;
}
const state: VerificationExecutionState = { managed: false, attemptStarted: false, attemptPersisted: false, accountUnchangedVerified: false };
export function verificationExecutorFailure(error: unknown, execution: VerificationExecutionState = state): Record<string, unknown> {
  let attemptPreserved: boolean | 'unknown' = false;
  if (execution.attemptPersisted) attemptPreserved = true;
  else if (execution.attemptStarted) attemptPreserved = 'unknown';
  return { status: 'STOP', stage: error instanceof AuthExecutorError ? error.stage : 'AUTH_VERIFICATION_EXECUTOR_STOPPED',
    productionChanged: execution.managed && execution.transport?.observations.writesAttempted ? 'unknown' : false,
    productionPasswordChanged: false, passwordMutationAllowed: false, accountUnchangedVerified: execution.accountUnchangedVerified,
    verificationAttemptPreserved: attemptPreserved,
    automaticRetryAllowed: false, inspectBeforeAnyFurtherAction: execution.managed && execution.attemptStarted,
    deploymentPerformed: false, readyForPublicLaunch: false };
}
async function injectionApplication(origin: string, key: string, transport: AuthVerificationTransport): Promise<FastifyInstance> {
  authRequire(!Object.keys(require.cache).some(file => /\/(?:config\/env|services\/supabaseClient|app\/createApplication)\.(?:ts|js)$/.test(file)),
    'AUTH_VERIFICATION_FRESH_PROCESS_REQUIRED');
  Object.assign(process.env, { NODE_ENV: 'production', PUBLIC_DEPLOYMENT: 'true', ALLOW_DEV_AUTH: 'false', BACKGROUND_JOBS_ENABLED: 'false',
    NTFY_ENABLED: 'false', NTFY_ACCESS_TOKEN: '', DATABASE_URL: '', CORS_ORIGINS: 'https://localhost', HOST: '127.0.0.1', TRUST_PROXY: 'false',
    JWT_SECRET: randomBytes(48).toString('base64url'), SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key,
    CLOUDFLARE_R2_ACCOUNT_ID: '', R2_ACCOUNT_ID: '', CLOUDFLARE_R2_BUCKET_NAME: '', R2_BUCKET_NAME: '',
    CLOUDFLARE_R2_PUBLIC_DOMAIN: '', R2_PUBLIC_DOMAIN: '', CLOUDFLARE_R2_ACCESS_KEY_ID: '', R2_ACCESS_KEY_ID: '',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: '', R2_SECRET_ACCESS_KEY: '' });
  globalThis.fetch = transport.fetch;
  const { runtimeConfig } = await import('../config/env.js');
  authRequire(runtimeConfig.publicDeployment && !runtimeConfig.allowDevelopmentAuth && !runtimeConfig.backgroundJobsEnabled
    && !runtimeConfig.ntfyEnabled && !runtimeConfig.databaseUrl && runtimeConfig.supabaseUrl === origin
    && runtimeConfig.supabaseServiceRoleKey === key, 'AUTH_VERIFICATION_RUNTIME_GUARDS');
  const { createApplication } = await import('../app/createApplication.js');
  const runtime = await createApplication(); runtime.app.log.level = 'silent'; return runtime.app;
}
function expectedBaseline(a: VerificationApproval): AuthBaseline {
  return { catalogSha256: a.catalogSha256, inventorySha256: a.inventorySha256, accountAuditSha256: a.accountAuditSha256,
    managedExtensionSha256: a.managedExtensionSha256, targetCatalogSha256: a.targetCatalogSha256, migrationApprovalSha256: a.migrationApprovalSha256 };
}
function requireCredentialBindings(credentials: VerificationCredentials, expected: Pick<VerificationCredentials, 'passwordCustodySha256' | 'temporaryCredentialSha256'>): void {
  authRequire(credentials.passwordCustodySha256 === expected.passwordCustodySha256
    && credentials.temporaryCredentialSha256 === expected.temporaryCredentialSha256, 'AUTH_VERIFICATION_ORIGINAL_CUSTODY_CHANGED');
}

export async function mainVerificationExecutor(args = process.argv.slice(2)): Promise<void> {
  const command = parseVerificationCommand(args);
  authRequire(process.env.ENV_FILE_LOADING === 'disabled', 'ENV_FILE_LOADING_MUST_BE_DISABLED');
  authRequire(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'AUTH_TLS_VERIFICATION_REQUIRED');
  authRequire(!Object.keys(require.cache).some(file => /\/(?:config\/env|services\/supabaseClient|app\/createApplication)\.(?:ts|js)$/.test(file)),
    'AUTH_VERIFICATION_FRESH_PROCESS_REQUIRED');
  const repository = resolve(__dirname, '../../..'), { snapshot } = await verifyCandidateFiles(repository), bundle = createWriterPackage(snapshot);
  const bindings: AuthExecutorBindings = { releaseSha: await requireWriterReleaseSha(repository, false),
    runnerSourceSha256: await authExecutorSourceHash(repository), packageSha256: bundle.packageSha256 };
  const workingTreeDirty = Boolean((await privateCommand('/usr/bin/git', ['-C', repository, 'status', '--porcelain'])).trim());
  if (command.mode === 'plan') {
    console.log(JSON.stringify({ status: 'PRODUCTION_AUTH_VERIFICATION_EXECUTOR_OFFLINE_PLAN', project: BACKUP_PROJECT, ...AUTH_ACCOUNT, ...bindings,
      workingTreeDirty, managedChecks: AUTH_VERIFICATION_CHECKS, guardChecks: AUTH_VERIFICATION_GUARDS,
      requiredAuthVersion: 2, requiredFirstLogin: false, productionExecutionImplemented: true, productionExecutionApproved: false,
      passwordMutationAllowed: false, oldApprovalReusable: false, verificationAttemptFile: AUTH_VERIFICATION_ATTEMPT_FILE,
      existingCredentialFiles: [AUTH_CUSTODY_FILE, AUTH_TEMPORARY_FILE],
      keychainServicesForFutureApply: ['sinegasi-prod-backup-age-identity', 'sinegasi-prod-postgres-admin-url', INTEGRATION_SERVICE_KEY],
      potentialProductionWrites: ['api_login_rate_limits: failure/clear counters', 'api_rate_limit_windows: request counters'],
      keychainAccessed: false, credentialFileRead: false, databaseAccessed: false, networkAccessed: false,
      productionLoginTested: false, productionPasswordChanged: false, productionChanged: false, deploymentPerformed: false, readyForPublicLaunch: false }));
    return;
  }
  const originalFetch = globalThis.fetch;
  let app: FastifyInstance | undefined;
  if (command.mode === 'rehearse') {
    const guardChecks = await rehearseVerificationExecutorGuards(), fixture = await createAuthAcceptanceFixture('rotated');
    const fingerprint = fixture.accountFingerprint(); let consumed = false;
    const transport = createIsolatedAuthVerificationTransport({ origin: AUTH_FIXTURE_ORIGIN, key: AUTH_FIXTURE_KEY,
      userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', deadline: Date.now() + 30_000,
      beforeRequest() { authRequire(consumed, 'AUTH_VERIFICATION_DURABLE_ATTEMPT_REQUIRED'); } }, fixture.fetch);
    let receipt: Record<string, unknown>;
    try {
      app = await injectionApplication(AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_KEY, transport);
      const checks = await runAuthVerificationFlow(app, {
        account: { userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', nama: 'Guru Terisolasi', role: 'teacher' },
        currentPassword: fixture.newPassword, previousPassword: fixture.temporaryPassword, transport,
        preflight: () => fixture.verifyRotatedCredentials(),
        async consumeAttempt() { authRequire(!consumed, 'AUTH_VERIFICATION_ATTEMPT_ALREADY_CONSUMED'); consumed = true; },
        async verifyPostcondition() {
          await fixture.verifyRotatedCredentials();
          authRequire(fixture.accountFingerprint() === fingerprint && fixture.snapshot().passwordRpcCalls === 0
            && fixture.snapshot().passwordChanges === 0, 'AUTH_VERIFICATION_FIXTURE_CHANGED');
        },
      });
      receipt = { status: 'ISOLATED_AUTH_VERIFICATION_EXECUTOR_PASSED', project: BACKUP_PROJECT, ...bindings, workingTreeDirty,
        observedAt: new Date().toISOString(), checks, guardChecks, fixture: fixture.snapshot(), requests: transport.observations,
        accountFingerprintUnchanged: true, isolatedDurableAttemptTested: true, realFastifyAuthRoutesTested: true,
        realPasswordHashAndJwtTested: true, realSupabaseSdkAdaptersTested: true, restStoreEmulated: true,
        databaseAtomicityTested: false, managedSupabaseIntegrationTested: false, productionLoginTested: false, productionPasswordChanged: false,
        previousProductionTokenTested: false, logoutServerRevocationImplemented: false, uiBrowserFlowTested: false,
        keychainAccessed: false, credentialFileRead: false, databaseAccessed: false, networkAccessed: false,
        workersStarted: false, productionChanged: false, deploymentPerformed: false, readyForPublicLaunch: false };
    } finally {
      transport.close(); globalThis.fetch = transport.fetch;
      try { await app?.close(); }
      finally {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.JWT_SECRET;
      }
    }
    console.log(JSON.stringify({ ...receipt, cleanupVerified: true }));
    return;
  }
  authRequire(process.platform === 'darwin', 'AUTH_VERIFICATION_MANAGED_REQUIRES_MAC'); process.umask(0o077); state.managed = true;
  let approval: VerificationApproval | undefined;
  let backupInventory: Awaited<ReturnType<typeof verifiedBackupInventory>> | undefined;
  if (command.mode === 'apply') {
    approval = validateVerificationApproval(await privateJson(command.approval), command.checksum, bindings, Date.now());
    await requireNoVerificationAttempt(AUTH_VERIFICATION_ATTEMPT_FILE);
    const recovery = await privateJson(AUTH_PRIVATE_ROOT + '/' + approval.recoveryEvidenceFile);
    validateVerificationEvidence(approval, { bootstrap: await privateJson(AUTH_PRIVATE_ROOT + '/' + AUTH_BOOTSTRAP_RECEIPT), recovery,
      baseline: await privateJson(AUTH_PRIVATE_ROOT + '/' + approval.baselineEvidenceFile),
      rehearsal: await privateJson(AUTH_PRIVATE_ROOT + '/' + approval.rehearsalEvidenceFile) }, Date.now());
    authRequire(await requireWriterReleaseSha(repository, true) === bindings.releaseSha, 'AUTH_VERIFICATION_CLEAN_MAIN_REQUIRED');
    const quality = await readGithubQualityMetadata(approval.qualityRunId); requireWriterQualityRun(quality.run, quality.jobs, bindings.releaseSha);
    console.log(JSON.stringify({ stage: 'AUTH_VERIFICATION_RECOVERY_KEYCHAIN_READY', service: 'sinegasi-prod-backup-age-identity', productionChanged: false }));
    backupInventory = await verifiedBackupInventory(approval.backupId, recovery);
  }
  authRequire(sha256(await privateJson(AUTH_PRIVATE_ROOT + '/' + AUTH_BOOTSTRAP_RECEIPT)) === AUTH_BOOTSTRAP_RECEIPT_SHA,
    'AUTH_VERIFICATION_BOOTSTRAP_RECEIPT_CHANGED');
  const credentials = readVerificationCredentialDocuments(await privateJson(AUTH_CUSTODY_FILE), await privateJson(AUTH_TEMPORARY_FILE));
  if (approval) requireCredentialBindings(credentials, approval);
  const ca = await readFile('/Users/memberid/Downloads/prod-ca-2021.crt', 'utf8'); validateBackupCa(ca);
  console.log(JSON.stringify({ stage: 'AUTH_VERIFICATION_ADMIN_KEYCHAIN_READY', service: 'sinegasi-prod-postgres-admin-url', readOnly: true, productionChanged: false }));
  const target = validateBackupTarget(await readKeychain('sinegasi-prod-postgres-admin-url', 'postgres'));
  const client = new pg.Client({ host: BACKUP_HOST, port: 5432, database: 'postgres', user: target.user, password: target.password,
    ssl: { ca, rejectUnauthorized: true, servername: BACKUP_HOST }, connectionTimeoutMillis: 12000, query_timeout: 30_000,
    application_name: 'sinegasi-auth-verification-readonly', options: '-c default_transaction_read_only=on' });
  let sessionFailed = false, locked = false, ended = false;
  client.on('error', () => { sessionFailed = true; });
  const db: WriterSession = { query: (sql, values) => client.query(sql, values ? [...values] : undefined), inventory: () => databaseInventory(client) };
  const observe = async () => {
    authRequire(!sessionFailed, 'AUTH_VERIFICATION_READONLY_SESSION_FAILED');
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      await client.query("SET LOCAL search_path=pg_catalog,public,extensions; SET LOCAL statement_timeout='10s'");
      const identity = (await client.query("SELECT current_database() AS db,current_user AS actor,current_setting('transaction_read_only') AS ro")).rows[0];
      authRequire(identity?.db === 'postgres' && identity.actor === 'postgres' && identity.ro === 'on', 'AUTH_VERIFICATION_READONLY_IDENTITY_REQUIRED');
      return await readAuthBaseline(db, bundle, true, true);
    } finally { await client.query('ROLLBACK'); }
  };
  const readCredentialsAgain = async () => {
    const current = readVerificationCredentialDocuments(await privateJson(AUTH_CUSTODY_FILE), await privateJson(AUTH_TEMPORARY_FILE));
    requireCredentialBindings(current, credentials); return current;
  };
  try {
    await client.connect(); target.password = '';
    if (command.mode === 'apply') {
      locked = (await client.query("SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired")).rows[0]?.acquired === true;
      authRequire(locked, 'AUTH_VERIFICATION_CONCURRENT_MAINTENANCE_REFUSED');
    }
    const before = await observe(); await requireVerificationCredentialMatch(before.user, credentials);
    // Observe only the reviewed loopback/account counter principals, including leftovers from the first attempt.
    const counterScope = createManagedAuthVerificationTransport('scope-only-not-a-provider-key', Date.now() + 60_000, () => {},
      async () => { throw new AuthExecutorError('AUTH_VERIFICATION_SCOPE_ONLY_NO_NETWORK'); });
    const requireCounterScope = async () => {
      const counters = (await client.query(`SELECT rate_key FROM public.api_login_rate_limits UNION ALL SELECT rate_key FROM public.api_rate_limit_windows`)).rows;
      authRequire(counters.every(row => [...counterScope.counterKeys.login, ...counterScope.counterKeys.api].includes(String(row.rate_key))),
        'AUTH_VERIFICATION_UNREVIEWED_COUNTER_ROWS');
    };
    await requireCounterScope();
    if (command.mode === 'inspect') {
      let verificationAttemptExists = false;
      try { await requireNoVerificationAttempt(AUTH_VERIFICATION_ATTEMPT_FILE); }
      catch (error: unknown) {
        if (!(error instanceof AuthExecutorError) || error.stage !== 'AUTH_VERIFICATION_PREVIOUS_ATTEMPT_INSPECT_NO_RETRY') throw error;
        verificationAttemptExists = true;
      }
      const receipt = { status: 'PRODUCTION_AUTH_VERIFICATION_VERSION_TWO_BASELINE', project: BACKUP_PROJECT, ...AUTH_ACCOUNT,
        ...bindings, ...before.baseline, passwordCustodySha256: credentials.passwordCustodySha256,
        temporaryCredentialSha256: credentials.temporaryCredentialSha256, rotationApprovalSha256: AUTH_ROTATION_APPROVAL_SHA,
        observedAt: new Date().toISOString(), workingTreeDirty, requiredAuthVersion: 2, requiredFirstLogin: false, accountStateVerified: true,
        passwordCustodyHashMatch: true, verificationAttemptExists, automaticRetryAllowed: false, keychainAccessed: true, credentialFileRead: true,
        productionLoginTested: false, productionChanged: false, deploymentPerformed: false, readyForPublicLaunch: false };
      const file = AUTH_PRIVATE_ROOT + '/production-auth.verification-baseline.' + receipt.observedAt.replace(/[:.]/g, '-') + '.json';
      await client.end(); ended = true;
      await persistAuthCustody(file, receipt); console.log(JSON.stringify({ ...receipt, evidenceFile: file })); return;
    }
    authRequire(approval && backupInventory && command.mode === 'apply', 'AUTH_VERIFICATION_NEW_APPLY_APPROVAL_REQUIRED');
    const a = approval;
    authRequire(JSON.stringify(before.baseline) === JSON.stringify(expectedBaseline(a)) && sha256(JSON.stringify(backupInventory)) === a.inventorySha256,
      'AUTH_VERIFICATION_LIVE_BASELINE_OR_BACKUP_DRIFT');
    const recheck = async () => {
      requireVerificationWindow(a, Date.now());
      authRequire(await requireWriterReleaseSha(repository, true) === bindings.releaseSha
        && await authExecutorSourceHash(repository) === bindings.runnerSourceSha256, 'AUTH_VERIFICATION_RELEASE_OR_SOURCE_CHANGED');
      await readCredentialsAgain();
    };
    await recheck();
    console.log(JSON.stringify({ stage: 'AUTH_VERIFICATION_SERVICE_KEYCHAIN_READY', service: INTEGRATION_SERVICE_KEY, productionChanged: false }));
    const key = validateIntegrationKey(await readKeychain(INTEGRATION_SERVICE_KEY, BACKUP_PROJECT), 'service_role');
    const transport = createManagedAuthVerificationTransport(key, Math.min(Date.parse(a.windowEnd), Date.now() + 5 * 60_000), () => {
      requireVerificationWindow(a, Date.now()); authRequire(state.attemptPersisted, 'AUTH_VERIFICATION_DURABLE_ATTEMPT_REQUIRED');
    }, originalFetch); state.transport = transport;
    app = await injectionApplication(INTEGRATION_ORIGIN, key, transport);
    const checks = await runAuthVerificationFlow(app, { account: AUTH_ACCOUNT, currentPassword: credentials.currentPassword,
      previousPassword: credentials.previousPassword, transport,
      async preflight() {
        await recheck(); await requireNoVerificationAttempt(AUTH_VERIFICATION_ATTEMPT_FILE);
        const latest = await observe();
        authRequire(JSON.stringify(latest.baseline) === JSON.stringify(before.baseline), 'AUTH_VERIFICATION_BASELINE_CHANGED_BEFORE_LOGIN');
        await requireVerificationCredentialMatch(latest.user, credentials); await requireCounterScope();
      },
      async consumeAttempt() {
        state.attemptStarted = true;
        await persistVerificationAttempt(AUTH_VERIFICATION_ATTEMPT_FILE, command.checksum, bindings, credentials); state.attemptPersisted = true;
      },
      async verifyPostcondition() {
        await recheck(); const after = await observe();
        requireVerificationUnchanged(before.baseline, after.baseline);
        await requireVerificationCredentialMatch(after.user, credentials); await requireCounterScope();
        state.accountUnchangedVerified = true;
      },
    });
    await app.close(); app = undefined;
    authRequire(!sessionFailed && (await client.query("SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations')) AS released")).rows[0]?.released === true,
      'AUTH_VERIFICATION_MAINTENANCE_UNLOCK_FAILED'); locked = false;
    await client.end(); ended = true;
    transport.close(); globalThis.fetch = transport.fetch;
    const result = { status: 'MANAGED_POST_ROTATION_TEACHER_AUTH_VERIFICATION_PASSED', project: BACKUP_PROJECT, ...AUTH_ACCOUNT, ...bindings,
      approvalSha256: command.checksum, observedAt: new Date().toISOString(), checks, requests: transport.observations,
      verificationAttemptFile: AUTH_VERIFICATION_ATTEMPT_FILE, accountAuditUnchanged: true, existingPasswordCustodyUnchanged: true,
      productionChanged: true, productionPasswordChanged: false, passwordMutationAllowed: false, productionLoginTested: true,
      macInjectedRoutes: true, deployedBackendTested: false, previousProductionTokenTested: false,
      uiBrowserFlowTested: false, crossWorkerRevocationTested: false, logoutServerRevocationImplemented: false,
      workersStarted: false, deploymentPerformed: false, readyForPublicLaunch: false };
    await persistAuthCustody(AUTH_PRIVATE_ROOT + '/production-auth.verification-result.' + result.observedAt.replace(/[:.]/g, '-') + '.json', result);
    console.log(JSON.stringify(result));
  } finally {
    if (state.transport) { state.transport.close(); globalThis.fetch = state.transport.fetch; }
    else globalThis.fetch = originalFetch; // Inspection/pre-runtime errors never constructed an SDK client.
    try { await app?.close(); }
    finally {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.JWT_SECRET;
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations'))").catch(() => {});
      target.password = ''; if (!ended) await client.end().catch(() => {});
    }
  }
}
if (require.main === module) void mainVerificationExecutor().catch((error: unknown) => {
  console.error(JSON.stringify(verificationExecutorFailure(error))); process.exitCode = 1;
});
