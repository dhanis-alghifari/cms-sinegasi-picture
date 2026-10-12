import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { BootstrapTeacherError } from './bootstrapTeacherCore.js';
import { privateBootstrapCredentialStore } from './bootstrapTeacherCredentials.js';
import { BACKUP_HOST, BACKUP_PROJECT, databaseInventory, readGithubQualityMetadata, readKeychain,
  validateBackupCa, validateBackupTarget } from './productionBackupCore.js';
import { sha256, verifyCandidateFiles } from './productionReconciliation.js';
import { createReferenceDataPlan } from './productionReferenceData.js';
import { privateJson, requireWriterReleaseSha, verifiedBackupInventory, WRITER_SOURCE_FILES } from './reconciliationWriter.js';
import { createWriterPackage, requireWriterQualityRun } from './reconciliationWriterPolicy.js';
import { verifyWriterTarget, writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';
import { readManagedTrigram } from './reconciliationWriterExtensions.js';
import { bootstrapApprovedProductionTeacher, requireCompletedBootstrapCheckpoint, validateBootstrapEvidence,
  validateProductionBootstrapApproval, type BootstrapReviewBindings, type ProductionBootstrapAuthorization } from './productionBootstrapTeacherCore.js';

type BootstrapCommand = { mode: 'plan' } | { mode: 'inspect' } | { mode: 'apply'; approval: string; checksum: string };
export function parseProductionBootstrapCommand(args: readonly string[]): BootstrapCommand {
  if (args.length === 1 && args[0] === 'plan') return { mode: 'plan' };
  if (args.length === 2 && args[0] === 'inspect' && args[1] === '--keychain-ready') return { mode: 'inspect' };
  if (args.length === 6 && args[0] === 'apply' && args[1] === '--approval' && args[3] === '--confirm-approval'
    && args[5] === '--keychain-ready' && args[2].startsWith('/') && !args[2].includes('\0') && /^[a-f0-9]{64}$/.test(args[4])) {
    return { mode: 'apply', approval: args[2], checksum: args[4] };
  }
  throw new BootstrapTeacherError('USE_PLAN_OR_EXPLICIT_KEYCHAIN_READY_INSPECT_OR_REVIEWED_APPLY');
}

const BOOTSTRAP_SOURCE_FILES = [...WRITER_SOURCE_FILES, 'backend/src/scripts/productionBootstrapTeacher.ts',
  'backend/src/scripts/productionBootstrapTeacherCore.ts', 'backend/src/scripts/productionBootstrapTeacher.test.ts',
  'backend/src/scripts/bootstrapTeacher.ts', 'backend/src/scripts/bootstrapTeacherCore.ts',
  'backend/src/scripts/bootstrapTeacherCredentials.ts', 'backend/src/scripts/bootstrapTeacher.test.ts',
  'backend/src/scripts/productionBootstrapTeacherFixtures.ts', 'backend/src/scripts/verifyProductionBootstrapTeacher.ts',
  'backend/src/scripts/copyEncryptedBackupToVps.ts', 'backend/src/services/passwordService.ts',
  'backend/src/scripts/productionManagedIntegration.ts', 'backend/src/scripts/productionManagedIntegrationCore.ts',
  'backend/src/scripts/productionApiRehearsalCore.ts', 'backend/package.json', 'backend/package-lock.json',
  'backend/tsconfig.json', '.github/workflows/quality.yml'] as const;
export async function bootstrapSourceHash(repository: string): Promise<string> {
  return sha256(JSON.stringify(await Promise.all(BOOTSTRAP_SOURCE_FILES.map(async file =>
    [file, sha256(await readFile(resolve(repository, file)))]))));
}
async function readEvidence(repository: string, file: string): Promise<string> {
  const handle = await open(resolve(repository, 'ops', file), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new BootstrapTeacherError('BOOTSTRAP_EVIDENCE_TOO_LARGE');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}

export async function mainProductionBootstrap(args = process.argv.slice(2)): Promise<void> {
  const command = parseProductionBootstrapCommand(args);
  if (process.env.ENV_FILE_LOADING !== 'disabled') throw new BootstrapTeacherError('ENV_FILE_LOADING_MUST_BE_DISABLED');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new BootstrapTeacherError('TLS_VERIFICATION_REQUIRED');
  const repository = resolve(__dirname, '../../..');
  const candidate = await verifyCandidateFiles(repository), bundle = createWriterPackage(candidate.snapshot);
  const reference = createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, 5000);
  const bindings: BootstrapReviewBindings = {
    releaseSha: await requireWriterReleaseSha(repository, command.mode === 'apply'),
    runnerSourceSha256: await bootstrapSourceHash(repository), schemaPackageSha256: candidate.fingerprint,
    referenceChecksum: reference.checksum,
    integrationSourceSha256: sha256(JSON.stringify(await Promise.all(['productionManagedIntegration.ts', 'productionManagedIntegrationCore.ts'].map(async file =>
      [file, sha256(await readFile(resolve(repository, 'backend/src/scripts', file)))])))),
  };
  if (command.mode === 'plan') {
    console.log(JSON.stringify({ status: 'PRODUCTION_BOOTSTRAP_OFFLINE_PLAN', project: BACKUP_PROJECT, ...bindings,
      packageSha256: bundle.packageSha256, role: 'teacher', isFirstLogin: true, databaseAccessed: false,
      networkAccessed: false, productionChanged: false, accountCreated: false, deploymentPerformed: false,
      productionApproved: false, readyForPublicLaunch: false,
      next: ['isolated guard rehearsal', 'review/push exact code and successful main quality CI',
        'fresh post-migration encrypted backup/restore/VPS copy', 'keychain-ready read-only inspect',
        'new approval checksum for ONE named teacher; no deployment'] }));
    return;
  }
  if (process.platform !== 'darwin') throw new BootstrapTeacherError('PRODUCTION_BOOTSTRAP_REQUIRES_MAC_KEYCHAIN');
  process.umask(0o077);
  let authorization: ProductionBootstrapAuthorization | undefined;
  let credentialFile: string | undefined;
  if (command.mode === 'apply') {
    const approvalRaw = await privateJson(command.approval);
    if (sha256(approvalRaw) !== command.checksum) throw new BootstrapTeacherError('BOOTSTRAP_APPROVAL_CHECKSUM_MISMATCH');
    const approval = validateProductionBootstrapApproval(JSON.parse(approvalRaw) as unknown, bundle, bindings, Date.now());
    const review = { ...bindings, approvalRaw, confirmedApprovalSha256: command.checksum,
      integrationRaw: await privateJson(resolve('/Users/memberid/Library/Application Support/Sinegasi/Reconciliation', approval.integrationEvidenceFile)),
      rehearsalRaw: await readEvidence(repository, approval.rehearsalEvidenceFile),
      recoveryRaw: await privateJson('/Users/memberid/Library/Application Support/Sinegasi/Reconciliation/recovery.json') };
    validateBootstrapEvidence(review, approval, bundle, Date.now());
    const { run, jobs } = await readGithubQualityMetadata(approval.qualityRunId);
    requireWriterQualityRun(run, jobs, bindings.releaseSha);
    // Rechecks local ciphertext/restore receipt, remote checksum and Mac key availability.
    authorization = { ...review, backupInventory: await verifiedBackupInventory(approval.backupId, review.recoveryRaw) };
    credentialFile = approval.credentialFile;
  }
  const ca = await readFile('/Users/memberid/Downloads/prod-ca-2021.crt', 'utf8'); validateBackupCa(ca);
  console.log(JSON.stringify({ stage: 'KEYCHAIN_ADMIN_READ_REQUIRED', service: 'sinegasi-prod-postgres-admin-url',
    readOnly: command.mode === 'inspect', productionChanged: false }));
  let raw = await readKeychain('sinegasi-prod-postgres-admin-url', 'postgres');
  const target = validateBackupTarget(raw); raw = '';
  const client = new pg.Client({ host: BACKUP_HOST, port: 5432, database: 'postgres', user: target.user, password: target.password,
    ssl: { ca, rejectUnauthorized: true, servername: BACKUP_HOST }, connectionTimeoutMillis: 12000, query_timeout: 30000,
    application_name: 'sinegasi-reviewed-first-teacher', options: command.mode === 'inspect'
      ? '-c default_transaction_read_only=on' : '-c default_transaction_read_only=off' });
  client.on('error', () => {});
  const db: WriterSession = { query: (sql, values) => client.query(sql, values ? [...values] : undefined), inventory: () => databaseInventory(client) };
  try {
    await client.connect(); target.password = '';
    if (command.mode === 'inspect') {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL search_path=pg_catalog,public,extensions; SET LOCAL statement_timeout='10s'");
      const identity = (await client.query("SELECT current_database() AS database,current_user AS actor,current_setting('transaction_read_only') AS read_only")).rows[0];
      if (identity?.database !== 'postgres' || identity.actor !== 'postgres' || identity.read_only !== 'on') throw new BootstrapTeacherError('BOOTSTRAP_READONLY_IDENTITY_REQUIRED');
      const checkpoint = await requireCompletedBootstrapCheckpoint(db, bundle);
      const managed = await readManagedTrigram(db);
      const catalog = await verifyWriterTarget(db, bundle.snapshot, bundle.reference, managed.sha256);
      if (writerCatalogHash(catalog) !== checkpoint.targetCatalogSha256) throw new BootstrapTeacherError('BOOTSTRAP_CATALOG_DRIFT_REFUSED');
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ status: 'BOOTSTRAP_COMPLETED_MIGRATION_OBSERVED', ...checkpoint,
        observedAt: new Date().toISOString(), managedExtensionSha256: managed.sha256,
        inventorySha256: sha256(JSON.stringify(catalog.inventory)), productionApproved: false,
        accountCreated: false, productionChanged: false, deploymentPerformed: false }));
    } else if (authorization && credentialFile) {
      // Detect workspace/source drift while external evidence was checked.
      if (await requireWriterReleaseSha(repository, true) !== bindings.releaseSha
        || await bootstrapSourceHash(repository) !== bindings.runnerSourceSha256) throw new BootstrapTeacherError('BOOTSTRAP_RELEASE_CHANGED');
      const result = await bootstrapApprovedProductionTeacher(db, privateBootstrapCredentialStore(credentialFile), bundle, authorization);
      console.log(JSON.stringify({ status: 'FIRST_TEACHER_CREATED', ...result, productionChanged: true,
        accountCreated: true, deploymentPerformed: false, readyForPublicLaunch: false }));
    }
  } finally { target.password = ''; await client.end().catch(() => {}); }
}

if (require.main === module) void mainProductionBootstrap().catch((error: unknown) => {
  const code = error instanceof BootstrapTeacherError ? error.code : 'PRODUCTION_BOOTSTRAP_STOPPED';
  console.error(JSON.stringify({ status: 'STOP', stage: code,
    productionChanged: code.includes('UNCERTAIN') ? 'unknown' : false,
    inspectBeforeRetry: code.includes('UNCERTAIN'), deploymentPerformed: false }));
  process.exitCode = 1;
});
