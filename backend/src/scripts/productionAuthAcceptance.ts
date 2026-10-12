import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { AUTH_ACCEPTANCE_CHECKS, rehearseAuthFlow } from './authAcceptanceFlow.js';
import { AuthAcceptanceError, AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, createAuthAcceptanceFixture,
  requireAuthAcceptanceArguments } from './authAcceptanceFixture.js';

async function main(args = process.argv.slice(2)): Promise<void> {
  const mode = requireAuthAcceptanceArguments(args);
  if (process.env.ENV_FILE_LOADING !== 'disabled') throw new AuthAcceptanceError('ENV_FILE_LOADING_MUST_BE_DISABLED');
  if (mode === 'plan') {
    console.log(JSON.stringify({ status: 'PRODUCTION_AUTH_OFFLINE_PLAN',
      project: 'pvbdiftvzoeelibxlxzb', userId: '2553f46c-5e6f-461d-ac4f-f24d4dced9ef',
      username: 'admin', nama: 'visioner', role: 'teacher', checks: AUTH_ACCEPTANCE_CHECKS,
      isolatedOnlyChecks: ['WRONG_PASSWORD_DENIED', 'INVALID_PASSWORD_CHANGES_LEAVE_ACCOUNT_UNCHANGED',
        'ATOMIC_VERSION_CONFLICT_FAILS_CLOSED', 'IDENTITY_OUTAGE_FAILS_CLOSED', 'RATE_STORE_OUTAGE_FAILS_CLOSED'],
      nextProductionRequirements: ['PREPARE_AND_TEST_SEPARATE_APPROVAL_GATED_MANAGED_EXECUTOR',
        'REVIEW_AND_PROMOTE_EXACT_RUNNER_THROUGH_MAIN_CI',
        'NEW_POST_BOOTSTRAP_BACKUP_RESTORE_AND_ENCRYPTED_COPY', 'POST_BOOTSTRAP_BASELINE_INSPECTION',
        'NEW_SCOPED_WRITE_APPROVAL_CHECKSUM_AND_WINDOW', 'PRIVATE_NEW_PASSWORD_CUSTODY_BEFORE_MUTATION'],
      potentialProductionWrites: ['users: one password rotation and auth_version increment',
        'activity_logs: password audit', 'api_login_rate_limits: failure/clear counters',
        'api_rate_limit_windows: request counters'],
      productionExecutionImplemented: false, oldBootstrapApprovalReusable: false,
      keychainAccessed: false, credentialFileRead: false, databaseAccessed: false, networkAccessed: false,
      productionChanged: false, deploymentPerformed: false, readyForPublicLaunch: false }));
    return;
  }
  // Do not permit a cached real client/config in an imported harness or existing server.
  if (Object.keys(require.cache).some(file => /\/(?:config\/env|services\/supabaseClient|app\/createApplication)\.(?:ts|js)$/.test(file))) {
    throw new AuthAcceptanceError('FRESH_ISOLATED_PROCESS_REQUIRED');
  }
  const fixture = await createAuthAcceptanceFixture();
  const originalFetch = globalThis.fetch;
  let app: FastifyInstance | undefined;
  try {
    Object.assign(process.env, {
      NODE_ENV: 'production', PUBLIC_DEPLOYMENT: 'true', ALLOW_DEV_AUTH: 'false', BACKGROUND_JOBS_ENABLED: 'false',
      NTFY_ENABLED: 'false', NTFY_ACCESS_TOKEN: '', DATABASE_URL: '',
      CORS_ORIGINS: 'https://localhost', HOST: '127.0.0.1', TRUST_PROXY: 'false',
      JWT_SECRET: randomBytes(48).toString('base64url'), SUPABASE_URL: AUTH_FIXTURE_ORIGIN, SUPABASE_SERVICE_ROLE_KEY: AUTH_FIXTURE_KEY,
      CLOUDFLARE_R2_ACCOUNT_ID: '', R2_ACCOUNT_ID: '', CLOUDFLARE_R2_BUCKET_NAME: '', R2_BUCKET_NAME: '',
      CLOUDFLARE_R2_PUBLIC_DOMAIN: '', R2_PUBLIC_DOMAIN: '', CLOUDFLARE_R2_ACCESS_KEY_ID: '', R2_ACCESS_KEY_ID: '',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: '', R2_SECRET_ACCESS_KEY: '',
    });
    globalThis.fetch = fixture.fetch;
    const { runtimeConfig } = await import('../config/env.js');
    if (!runtimeConfig.publicDeployment || runtimeConfig.allowDevelopmentAuth || runtimeConfig.backgroundJobsEnabled
      || runtimeConfig.ntfyEnabled || runtimeConfig.databaseUrl || runtimeConfig.supabaseUrl !== AUTH_FIXTURE_ORIGIN
      || runtimeConfig.supabaseServiceRoleKey !== AUTH_FIXTURE_KEY) throw new AuthAcceptanceError('ISOLATED_RUNTIME_GUARDS_FAILED');
    const { createApplication } = await import('../app/createApplication.js');
    const { clearAuthStateCache } = await import('../modules/auth/auth.identity.js');
    const runtime = await createApplication(); app = runtime.app; app.log.level = 'silent';
    const checks = await rehearseAuthFlow(app, fixture, clearAuthStateCache);
    await app.close(); app = undefined;
    console.log(JSON.stringify({ status: 'ISOLATED_AUTH_ACCEPTANCE_PASSED', checks,
      observedAt: new Date().toISOString(), fixture: fixture.snapshot(),
      realFastifyAuthRoutesTested: true, realPasswordHashAndJwtTested: true, realSupabaseSdkAdaptersTested: true,
      restStoreEmulated: true, databaseAtomicityTested: false, managedSupabaseIntegrationTested: false,
      productionLoginTested: false, productionPasswordChanged: false, logoutServerRevocationImplemented: false,
      uiBrowserFlowTested: false, keychainAccessed: false, credentialFileRead: false, networkAccessed: false,
      workersStarted: false, productionChanged: false, devDatabaseChanged: false, deploymentPerformed: false,
      readyForPublicLaunch: false }));
  } finally {
    await app?.close(); globalThis.fetch = originalFetch;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.JWT_SECRET;
  }
}

if (require.main === module) void main().catch((error: unknown) => {
  // No provider exception, request payload, password, hash or bearer token output.
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof AuthAcceptanceError ? error.stage : 'ISOLATED_AUTH_REHEARSAL_FAILED',
    productionChanged: false, productionPasswordChanged: false, deploymentPerformed: false }));
  process.exitCode = 1;
});
