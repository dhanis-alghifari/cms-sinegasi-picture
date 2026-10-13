import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_USER_ID, AuthAcceptanceError,
  createAuthAcceptanceFixture, requireAuthAcceptanceArguments, type AuthAcceptanceFixture } from './authAcceptanceFixture.js';
import { AUTH_VERIFICATION_CHECKS, createIsolatedVerificationAttempt, runAuthVerificationFlow } from './authVerificationFlow.js';
import { AUTH_ACCOUNT, AuthExecutorError, authRecord, authRequire } from './productionAuthExecutorCore.js';
import { createIsolatedAuthVerificationTransport } from './productionAuthTransport.js';

const ISOLATED_ONLY_CHECKS = ['SYNTHETIC_VERSION_ONE_SESSION_DENIED'] as const;
const boundaries = { productionExecutionImplemented: false, productionExecutionApproved: false,
  passwordRotationAllowed: false, oldApprovalReusable: false, durableProductionAttemptLatchImplemented: false,
  keychainAccessed: false, credentialFileRead: false, databaseAccessed: false, networkAccessed: false,
  productionLoginTested: false, productionPasswordChanged: false, previousProductionTokenTested: false,
  productionChanged: false, devDatabaseChanged: false, workersStarted: false, deploymentPerformed: false, readyForPublicLaunch: false } as const;

/** Exported for synthetic fault injection only. There is deliberately no managed apply/inspect path. */
export async function rehearseAuthVerification(syntheticFixture?: AuthAcceptanceFixture) {
  authRequire(process.env.ENV_FILE_LOADING === 'disabled', 'ENV_FILE_LOADING_MUST_BE_DISABLED');
  authRequire(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_MUST_REMAIN_ENABLED');
  authRequire(!Object.keys(require.cache).some(file => /\/(?:config\/env|services\/supabaseClient|app\/createApplication)\.(?:ts|js)$/.test(file)),
    'FRESH_ISOLATED_PROCESS_REQUIRED');
  const fixture = syntheticFixture ?? await createAuthAcceptanceFixture('rotated');
  const currentPassword = fixture.newPassword, previousPassword = fixture.temporaryPassword;
  await fixture.verifyRotatedCredentials(currentPassword, previousPassword);
  const fingerprint = fixture.accountFingerprint();
  const transport = createIsolatedAuthVerificationTransport({ origin: AUTH_FIXTURE_ORIGIN, key: AUTH_FIXTURE_KEY,
    userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', deadline: Date.now() + 30_000, beforeRequest() {} }, fixture.fetch);
  let app: FastifyInstance | undefined;
  try {
    Object.assign(process.env, {
      NODE_ENV: 'production', PUBLIC_DEPLOYMENT: 'true', ALLOW_DEV_AUTH: 'false', BACKGROUND_JOBS_ENABLED: 'false',
      NTFY_ENABLED: 'false', NTFY_ACCESS_TOKEN: '', DATABASE_URL: '', CORS_ORIGINS: 'https://localhost', HOST: '127.0.0.1', TRUST_PROXY: 'false',
      JWT_SECRET: randomBytes(48).toString('base64url'), SUPABASE_URL: AUTH_FIXTURE_ORIGIN, SUPABASE_SERVICE_ROLE_KEY: AUTH_FIXTURE_KEY,
      CLOUDFLARE_R2_ACCOUNT_ID: '', R2_ACCOUNT_ID: '', CLOUDFLARE_R2_BUCKET_NAME: '', R2_BUCKET_NAME: '',
      CLOUDFLARE_R2_PUBLIC_DOMAIN: '', R2_PUBLIC_DOMAIN: '', CLOUDFLARE_R2_ACCESS_KEY_ID: '', R2_ACCESS_KEY_ID: '',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: '', R2_SECRET_ACCESS_KEY: '',
    });
    globalThis.fetch = transport.fetch;
    const { runtimeConfig } = await import('../config/env.js');
    authRequire(runtimeConfig.publicDeployment && !runtimeConfig.allowDevelopmentAuth && !runtimeConfig.backgroundJobsEnabled
      && !runtimeConfig.ntfyEnabled && !runtimeConfig.databaseUrl && runtimeConfig.supabaseUrl === AUTH_FIXTURE_ORIGIN
      && runtimeConfig.supabaseServiceRoleKey === AUTH_FIXTURE_KEY, 'ISOLATED_RUNTIME_GUARDS_FAILED');
    const { createApplication } = await import('../app/createApplication.js');
    const runtime = await createApplication(); app = runtime.app; app.log.level = 'silent';
    const checks = await runAuthVerificationFlow(app, {
      account: { userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', nama: 'Guru Terisolasi', role: 'teacher' },
      currentPassword, previousPassword, transport,
      preflight: () => fixture.verifyRotatedCredentials(currentPassword, previousPassword), consumeAttempt: createIsolatedVerificationAttempt(),
      async verifyPostcondition() {
        await fixture.verifyRotatedCredentials(currentPassword, previousPassword);
        authRequire(fixture.accountFingerprint() === fingerprint && fixture.snapshot().passwordChanges === 0
          && fixture.snapshot().passwordRpcCalls === 0, 'AUTH_VERIFICATION_ACCOUNT_CHANGED');
      },
    });
    // This JWT is freshly signed in isolation, NOT the previous live production session.
    const stale = app.jwt.sign({ userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', role: 'teacher', isFirstLogin: true, authVersion: 1 });
    for (const url of ['/api/auth/me', '/api/access-control/matrix']) {
      const denied = await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${stale}` } });
      transport.assertHealthy();
      authRequire(denied.statusCode === 401 && authRecord(denied.json()).error === 'SESSION_REVOKED', 'AUTH_VERIFICATION_STALE_SYNTHETIC_SESSION_VALID');
    }
    authRequire(fixture.accountFingerprint() === fingerprint && fixture.snapshot().passwordRpcCalls === 0
      && fixture.snapshot().passwordChanges === 0 && transport.observations.rotationAttempts === 0
      && transport.observations.blocked === 0 && fixture.snapshot().blocked === 0, 'AUTH_VERIFICATION_FINAL_STATE_INVALID');
    return { status: 'ISOLATED_POST_ROTATION_AUTH_VERIFICATION_PASSED', checks, isolatedOnlyChecks: ISOLATED_ONLY_CHECKS,
      observedAt: new Date().toISOString(), fixture: fixture.snapshot(), requests: transport.observations,
      accountFingerprintUnchanged: true, realFastifyAuthRoutesTested: true, realPasswordHashAndJwtTested: true,
      realSupabaseSdkAdaptersTested: true, restStoreEmulated: true, databaseAtomicityTested: false,
      managedSupabaseIntegrationTested: false, logoutServerRevocationImplemented: false, uiBrowserFlowTested: false, ...boundaries };
  } finally {
    // Seal immediately, even if application shutdown fails or waits on other requests.
    transport.close(); globalThis.fetch = transport.fetch;
    try { await app?.close(); }
    finally {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.JWT_SECRET;
    }
  }
}

async function main(args = process.argv.slice(2)): Promise<void> {
  const mode = requireAuthAcceptanceArguments(args);
  authRequire(process.env.ENV_FILE_LOADING === 'disabled', 'ENV_FILE_LOADING_MUST_BE_DISABLED');
  authRequire(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_MUST_REMAIN_ENABLED');
  if (mode === 'plan') {
    console.log(JSON.stringify({ status: 'POST_ROTATION_AUTH_VERIFICATION_OFFLINE_PLAN', project: 'pvbdiftvzoeelibxlxzb',
      ...AUTH_ACCOUNT, requiredAuthVersion: 2, requiredFirstLogin: false, checks: AUTH_VERIFICATION_CHECKS,
      isolatedOnlyChecks: ISOLATED_ONLY_CHECKS,
      potentialProductionWrites: ['api_login_rate_limits: failure/clear counters', 'api_rate_limit_windows: request counters'],
      forbiddenProductionWrites: ['users/password/auth_version', 'password audit', 'schema/permissions/configuration'],
      nextProductionRequirements: ['PREPARE_AND_TEST_SEPARATE_APPROVAL_GATED_VERIFICATION_EXECUTOR',
        'REVIEW_AND_PROMOTE_EXACT_RUNNER_THROUGH_MAIN_CI', 'NEW_POST_ROTATION_BACKUP_RESTORE_AND_ENCRYPTED_COPY',
        'POST_ROTATION_ACCOUNT_AND_AUDIT_BASELINE', 'PRIVATE_EXISTING_PASSWORD_CUSTODY_MATCHES_VERSION_TWO_SCRYPT_HASH',
        'NEW_COUNTER_WRITE_APPROVAL_CHECKSUM_AND_WINDOW', 'DURABLE_SEPARATE_ATTEMPT_LATCH_NO_RETRY_OR_RESET'], ...boundaries }));
    return;
  }
  console.log(JSON.stringify(await rehearseAuthVerification()));
}

if (require.main === module) void main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof AuthAcceptanceError || error instanceof AuthExecutorError
    ? error.stage : 'ISOLATED_POST_ROTATION_VERIFICATION_FAILED', ...boundaries }));
  process.exitCode = 1;
});
