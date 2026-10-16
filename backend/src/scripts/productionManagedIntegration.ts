import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { readKeychain, privateCommand } from './productionBackupCore.js';
import { createReferenceDataPlan } from './productionReferenceData.js';
import { sha256, verifyCandidateFiles } from './productionReconciliation.js';
import { createReadOnlyTransport, INTEGRATION_ORIGIN, INTEGRATION_PROJECT, INTEGRATION_PUBLIC_KEY, INTEGRATION_SERVICE_KEY,
  integrationRecord, integrationTableAccess, managedReadOnlyClient, ManagedIntegrationError, requireIntegrationArguments,
  validateIntegrationKey, verifyManagedReads } from './productionManagedIntegrationCore.js';

async function mainManagedIntegration(args = process.argv.slice(2)): Promise<void> {
  const mode = requireIntegrationArguments(args);
  if (process.env.ENV_FILE_LOADING !== 'disabled') throw new ManagedIntegrationError('ENV_FILE_LOADING_MUST_BE_DISABLED');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new ManagedIntegrationError('TLS_VERIFICATION_REQUIRED');
  const repository = resolve(__dirname, '../../..');
  const candidate = await verifyCandidateFiles(repository);
  if (candidate.snapshot.targetProject !== INTEGRATION_PROJECT) throw new ManagedIntegrationError('SNAPSHOT_TARGET_MISMATCH');
  const reference = createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, 5000);
  const tableAccess = integrationTableAccess(candidate.snapshot);
  const sourceFiles = ['productionManagedIntegration.ts', 'productionManagedIntegrationCore.ts'];
  const sourceSha256 = sha256(JSON.stringify(await Promise.all(sourceFiles.map(async file =>
    [file, sha256(await readFile(resolve(__dirname, file.replace(/\.ts$/, __filename.endsWith('.js') ? '.js' : '.ts'))))]))));
  if (mode === 'plan') {
    console.log(JSON.stringify({ status: 'MANAGED_READ_ONLY_INTEGRATION_PLAN', project: INTEGRATION_PROJECT,
      apiUrl: INTEGRATION_ORIGIN, apiKeysUrl: `https://supabase.com/dashboard/project/${INTEGRATION_PROJECT}/settings/api-keys`,
      keychain: { service: INTEGRATION_SERVICE_KEY, publishable: INTEGRATION_PUBLIC_KEY, account: INTEGRATION_PROJECT },
      sourceSha256, tables: candidate.snapshot.tables.length, views: candidate.snapshot.views.length,
      applicationTables: tableAccess.applicationTables.length, privateMigrationJournals: tableAccess.migrationJournals.map(table => table.relname),
      referenceRows: reference.tables.reduce((sum, table) => sum + table.rows.length, 0),
      networkAccessed: false, productionChanged: false, accountCreated: false, deploymentPerformed: false }));
    return;
  }
  if (process.platform !== 'darwin') throw new ManagedIntegrationError('MANAGED_TEST_REQUIRES_MAC_KEYCHAIN');
  const releaseSha = (await privateCommand('/usr/bin/git', ['-C', repository, 'rev-parse', 'HEAD'])).trim();
  const workingTreeDirty = Boolean((await privateCommand('/usr/bin/git', ['-C', repository, 'status', '--porcelain'])).trim());
  const checks: string[] = [];
  const transport = createReadOnlyTransport([...candidate.snapshot.tables.map(table => table.relname), ...candidate.snapshot.views.map(view => view.name)]);
  const originalFetch = globalThis.fetch;
  let app: FastifyInstance | undefined;
  let serviceKey = '', publicKey = '';
  try {
    console.log(JSON.stringify({ stage: 'API_KEYCHAIN_ALLOW_REQUIRED', services: [INTEGRATION_SERVICE_KEY, INTEGRATION_PUBLIC_KEY], productionChanged: false }));
    const readApiKey = async (service: string, role: 'service_role' | 'anon'): Promise<string> => {
      let raw: string;
      try { raw = await readKeychain(service, INTEGRATION_PROJECT); }
      catch { throw new ManagedIntegrationError(role === 'service_role'
        ? 'SERVICE_KEYCHAIN_ITEM_MISSING_OR_ALLOW_DENIED' : 'PUBLIC_KEYCHAIN_ITEM_MISSING_OR_ALLOW_DENIED'); }
      return validateIntegrationKey(raw, role);
    };
    serviceKey = await readApiKey(INTEGRATION_SERVICE_KEY, 'service_role');
    publicKey = await readApiKey(INTEGRATION_PUBLIC_KEY, 'anon');
    await verifyManagedReads(managedReadOnlyClient(serviceKey, transport), managedReadOnlyClient(publicKey, transport),
      candidate.snapshot, reference, stage => { checks.push(stage); console.log(JSON.stringify({ stage, productionChanged: false })); });

    // Fresh CLI process only. Do not import runtimeConfig/app until DEV env loading is disabled and
    // every network request is guarded. No listen(), workers, login, forged account or HTTP proxy.
    Object.assign(process.env, {
      NODE_ENV: 'production', PUBLIC_DEPLOYMENT: 'true', ALLOW_DEV_AUTH: 'false', BACKGROUND_JOBS_ENABLED: 'false',
      NTFY_ENABLED: 'false', CORS_ORIGINS: 'https://localhost', HOST: '127.0.0.1', TRUST_PROXY: 'false', DATABASE_URL: '',
      JWT_SECRET: randomBytes(48).toString('base64url'), SUPABASE_URL: INTEGRATION_ORIGIN, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    });
    globalThis.fetch = transport.fetch;
    const { runtimeConfig } = await import('../config/env.js');
    if (!runtimeConfig.publicDeployment || runtimeConfig.allowDevelopmentAuth || runtimeConfig.backgroundJobsEnabled || runtimeConfig.ntfyEnabled) {
      throw new ManagedIntegrationError('PRODUCTION_RUNTIME_GUARDS_NOT_ACTIVE');
    }
    const { createApplication } = await import('../app/createApplication.js');
    const application = await createApplication();
    app = application.app;
    app.log.level = 'silent';
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    if (response.statusCode !== 200 || integrationRecord(response.json()).status !== 'ok'
      || response.headers['x-content-type-options'] !== 'nosniff' || response.headers['cache-control'] !== 'no-store') {
      throw new ManagedIntegrationError('BACKEND_LIVENESS_OR_HEADERS_FAILED');
    }
    checks.push('REAL_APPLICATION_HEALTH_WITH_WORKERS_DISABLED');
    const { getAuthoritativeUser } = await import('../modules/auth/auth.identity.js');
    if (await getAuthoritativeUser(randomUUID()) !== null) throw new ManagedIntegrationError('UNEXPECTED_ACCOUNT_READ');
    checks.push('APPLICATION_AUTHORITATIVE_USER_READ_NO_MOCK');
    const { createAccessControlRepository, createAccessControlMemoryState } = await import('../modules/access-control/access-control.repository.js');
    const { supabase } = await import('../services/supabaseClient.js');
    if (!supabase) throw new ManagedIntegrationError('APPLICATION_SUPABASE_NOT_CONFIGURED');
    const matrix = await createAccessControlRepository(supabase, createAccessControlMemoryState()).getMatrix();
    if (matrix.error || !matrix.data || matrix.data.roles.length !== 9 || matrix.data.permissions.length !== 44
      || matrix.data.roles.reduce((sum, role) => sum + role.capabilities.length, 0) !== 150) {
      throw new ManagedIntegrationError('APPLICATION_ACCESS_MATRIX_READ_FAILED');
    }
    checks.push('APPLICATION_ACCESS_MATRIX_REAL_REPOSITORY');
    if (transport.observations.blocked !== 0) throw new ManagedIntegrationError('UNEXPECTED_APPLICATION_MUTATION_ATTEMPT');
    await app.close(); app = undefined;
    console.log(JSON.stringify({ status: 'MANAGED_SUPABASE_READ_ONLY_INTEGRATION_PASSED', observedAt: new Date().toISOString(),
      project: INTEGRATION_PROJECT, releaseSha, workingTreeDirty, sourceSha256, schemaPackageSha256: candidate.fingerprint,
      referenceChecksum: reference.checksum, checks, requests: transport.observations,
      applicationTables: tableAccess.applicationTables.length, privateMigrationJournalsDenied: tableAccess.migrationJournals.length,
      managedDataApiReadsTested: true, applicationReadAdaptersTested: true, authenticatedRoleHttpTested: false,
      fullApplicationAcceptancePassed: false, loginAndMutationFlowsTested: false, mediaStorageTested: false,
      productionChanged: false, accountCreated: false, workersStarted: false, deploymentPerformed: false, readyForPublicLaunch: false }));
  } finally {
    await app?.close();
    globalThis.fetch = originalFetch;
    serviceKey = ''; publicKey = '';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.JWT_SECRET;
  }
}

if (require.main === module) void mainManagedIntegration().catch((error: unknown) => {
  // Never print provider/Keychain exceptions, URLs, credentials or result payloads.
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof ManagedIntegrationError ? error.stage : 'MANAGED_INTEGRATION_FAILED',
    productionChanged: false, accountCreated: false, deploymentPerformed: false }));
  process.exitCode = 1;
});
