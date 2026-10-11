import { lstat, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import pg from 'pg';
import { AGE, BACKUP_HOST, BACKUP_KEY_SERVICE, BACKUP_PROJECT, BACKUP_ROOT, databaseInventory, privateCommand,
  privateCommandBytes, readKeychain, validateBackupCa, validateBackupTarget } from './productionBackupCore.js';
import { COPY_FILES, readCopyArtifact, validateCopyArtifacts } from './copyEncryptedBackupToVps.js';
import { loadPreflightPlan } from './productionReconciliationPreflightCore.js';
import { sha256 } from './productionReconciliation.js';
import { runReconciliationWriter } from './reconciliationWriterCore.js';
import { readWriterCatalog, writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';
import { createWriterPackage, object, parseWriterOptions, requireWriterQualityRun, validateWriterApproval, validateWriterEvidence, validateWriterRecovery, WriterError } from './reconciliationWriterPolicy.js';
import type { DatabaseInventory } from './productionBackupCore.js';

export const WRITER_SOURCE_FILES = [
  'backend/src/scripts/reconciliationWriter.ts', 'backend/src/scripts/reconciliationWriterPolicy.ts',
  'backend/src/scripts/reconciliationWriterCore.ts', 'backend/src/scripts/reconciliationWriterCatalog.ts',
  'backend/src/scripts/productionReconciliation.ts', 'backend/src/scripts/productionReferenceData.ts',
  'backend/src/scripts/productionBackupCore.ts', 'backend/src/scripts/migrationSafety.ts',
  'backend/src/scripts/productionReconciliationPreflightCore.ts', 'backend/src/middleware/capabilities.ts',
] as const;
export async function writerSourceHash(repository: string): Promise<string> {
  return sha256(JSON.stringify(await Promise.all(WRITER_SOURCE_FILES.map(async file => [file, sha256(await readFile(resolve(repository, file)))]))));
}
const PRIVATE_ROOT = '/Users/memberid/Library/Application Support/Sinegasi/Reconciliation';
const CA_PATH = '/Users/memberid/Downloads/prod-ca-2021.crt';
const SSH_ARGS = ['-4', '-F', '/dev/null', '-i', '/Users/memberid/.ssh/id_ed25519', '-o', 'IdentitiesOnly=yes',
  '-o', 'PreferredAuthentications=publickey', '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no',
  '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'ubuntu@43.157.242.8'];

async function privateJson(path: string): Promise<string> {
  if (dirname(path) !== PRIVATE_ROOT) throw new WriterError('APPROVAL_AND_RECOVERY_MUST_BE_IN_PRIVATE_MAC_DIRECTORY');
  for (const directory of ['/Users/memberid/Library/Application Support/Sinegasi', PRIVATE_ROOT]) {
    const parent = await lstat(directory);
    if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid?.() || (parent.mode & 0o777) !== 0o700) {
      throw new WriterError('PRIVATE_REVIEW_DIRECTORY_REQUIRED');
    }
  }
  const bytes = await readCopyArtifact(path);
  if (bytes.length > 1024 * 1024) throw new WriterError('REVIEW_DOCUMENT_TOO_LARGE');
  return bytes.toString('utf8');
}
async function releaseSha(repository: string, apply: boolean): Promise<string> {
  const git = (args: string[]) => privateCommand('/usr/bin/git', ['-C', repository, ...args]);
  const sha = (await git(['rev-parse', 'HEAD'])).trim();
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new WriterError('INVALID_RELEASE_SHA');
  if (apply && ((await git(['status', '--porcelain'])).trim() || (await git(['symbolic-ref', '--short', 'HEAD'])).trim() !== 'main'
    || (await git(['ls-remote', 'origin', 'refs/heads/main'])).trim().split(/\s/)[0] !== sha)) {
    throw new WriterError('CLEAN_REVIEWED_CURRENT_MAIN_RELEASE_REQUIRED');
  }
  return sha;
}
async function backupInventory(id: string, recoveryRaw: string): Promise<DatabaseInventory> {
  const directory = `${BACKUP_ROOT}/${id}`;
  const recovery = object(JSON.parse(recoveryRaw) as unknown);
  const files = Object.fromEntries(await Promise.all(COPY_FILES.map(async file => [file, await readCopyArtifact(`${directory}/${file}`)]))) as Record<typeof COPY_FILES[number], Buffer>;
  validateCopyArtifacts(id, files);
  if (JSON.stringify(JSON.parse(files['receipt.json'].toString('utf8')) as unknown) !== JSON.stringify(recovery.receipt)
    || JSON.stringify(JSON.parse(files['public-restore-verification.json'].toString('utf8')) as unknown) !== JSON.stringify(recovery.restore)
    || JSON.stringify(JSON.parse((await readCopyArtifact(directory + '/vps-copy-verification.json')).toString('utf8')) as unknown) !== JSON.stringify(recovery.copy)) {
    throw new WriterError('BACKUP_RECOVERY_FILES_CHANGED');
  }
  // Recheck that the root-owned remote ciphertext still exists, rather than trusting an old receipt.
  for (const file of ['database.dump.age', 'metadata.json.age'] as const) {
    const path = `/opt/sinegasi-backups/production/${id}/${file}`;
    const output = await privateCommand('/usr/bin/ssh', [...SSH_ARGS,
      `test "$(id -un)" = ubuntu && test "$(hostname)" = VM-11-154-ubuntu && sudo -n stat -c '%U:%a' '${path}' && sudo -n sha256sum '${path}'`]);
    if (output.trim().split('\n')[0] !== 'root:600' || output.trim().split('\n')[1]?.split(' ')[0] !== sha256(files[file])) {
      throw new WriterError('REMOTE_BACKUP_COPY_NOT_CURRENT');
    }
  }
  console.log(JSON.stringify({ stage: 'BACKUP_KEYCHAIN_ALLOW_REQUIRED', productionChanged: false }));
  let identity = (await readKeychain(BACKUP_KEY_SERVICE, BACKUP_PROJECT)).trim();
  if (!/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(identity)) throw new WriterError('INVALID_BACKUP_IDENTITY');
  const bytes = await privateCommandBytes(AGE, ['--decrypt', '-i', '-', directory + '/metadata.json.age'], identity + '\n');
  identity = '';
  try {
    const metadata = object(JSON.parse(bytes.toString('utf8')) as unknown);
    if (metadata.project !== BACKUP_PROJECT || metadata.id !== id) throw new WriterError('BACKUP_METADATA_TARGET_MISMATCH');
    // Shape and empty legacy table/column baseline are checked by the core before writes.
    return metadata.inventory as DatabaseInventory;
  } finally { bytes.fill(0); }
}

export async function mainWriter(args = process.argv.slice(2)): Promise<void> {
  const inspect = args.length === 1 && args[0] === 'inspect';
  const options = inspect ? { mode: 'plan' as const } : parseWriterOptions(args);
  const repository = resolve(__dirname, '../../..');
  const { snapshot, plan } = await loadPreflightPlan(repository);
  const bundle = createWriterPackage(snapshot), sourceSha256 = await writerSourceHash(repository);
  const sha = await releaseSha(repository, options.mode === 'apply');
  if (options.mode === 'plan' && !inspect) {
    console.log(JSON.stringify({ status: 'WRITER_REVIEW_PLAN_ONLY', project: BACKUP_PROJECT, releaseSha: sha,
      packageSha256: bundle.packageSha256, runnerSourceSha256: sourceSha256, candidateSha256: bundle.candidateSha256,
      referenceChecksum: bundle.reference.checksum, referenceRows: 213, billingAmount: 5000,
      priorEvidenceSha256: plan.evidenceSha256, productionApproved: false, databaseAccessed: false,
      productionChanged: false, next: ['isolated writer tests', 'review and commit release', 'fresh backup/restore/copy and independent key recovery',
        'read-only inspect', 'operator approval bound to current main and migration window', 'managed acceptance after migration'] }));
    return;
  }
  if (process.platform !== 'darwin') throw new WriterError('WRITER_REQUIRES_MAC_KEYCHAIN');
  process.umask(0o077);
  let authorization: Parameters<typeof runReconciliationWriter>[2] | undefined;
  if (options.mode === 'apply') {
    const approvalRaw = await privateJson(options.approval);
    if (object(JSON.parse(approvalRaw) as unknown).isolatedFixture !== undefined) throw new WriterError('TEST_APPROVAL_REFUSED_ON_PRODUCTION');
    if (sha256(approvalRaw) !== options.confirmedSha256) throw new WriterError('APPROVAL_CHECKSUM_MISMATCH');
    const evidenceFile = object(JSON.parse(approvalRaw) as unknown).writerEvidenceFile;
    if (typeof evidenceFile !== 'string' || !/^production-reconciliation\.writer-rehearsal\.[0-9TZ-]+\.json$/.test(evidenceFile)) throw new WriterError('WRITER_EVIDENCE_FILE_REQUIRED');
    const evidenceRaw = await readFile(resolve(repository, 'ops', evidenceFile), 'utf8');
    const evidence = object(JSON.parse(evidenceRaw) as unknown);
    validateWriterEvidence(evidence, bundle);
    if (evidence.runnerSourceSha256 !== sourceSha256 || JSON.stringify(evidence.priorEvidenceSha256) !== JSON.stringify(plan.evidenceSha256)) {
      throw new WriterError('WRITER_SOURCE_OR_REHEARSAL_EVIDENCE_CHANGED');
    }
    const approval = validateWriterApproval(JSON.parse(approvalRaw) as unknown, bundle, sha, sha256(evidenceRaw));
    const api = `repos/dhanis-alghifari/cms-sinegasi-picture/actions/runs/${approval.qualityRunId}`;
    const run = JSON.parse(await privateCommand('/opt/homebrew/bin/gh', ['api', api])) as unknown;
    const jobs = JSON.parse(await privateCommand('/opt/homebrew/bin/gh', ['api', api + '/jobs?per_page=100'])) as unknown;
    requireWriterQualityRun(run, jobs, sha);
    const recoveryRaw = await privateJson(PRIVATE_ROOT + '/recovery.json');
    if (sha256(recoveryRaw) !== approval.recoveryEvidenceSha256) throw new WriterError('RECOVERY_EVIDENCE_CHECKSUM_MISMATCH');
    validateWriterRecovery(JSON.parse(recoveryRaw) as unknown, approval);
    authorization = { releaseSha: sha, approvalRaw, confirmedApprovalSha256: options.confirmedSha256, evidenceRaw, recoveryRaw,
      backupInventory: await backupInventory(approval.backupId, recoveryRaw) };
  }
  const ca = await readFile(CA_PATH, 'utf8'); validateBackupCa(ca);
  console.log(JSON.stringify({ stage: 'KEYCHAIN_ADMIN_READ_REQUIRED', readOnly: inspect, productionChanged: false }));
  let raw = await readKeychain('sinegasi-prod-postgres-admin-url', 'postgres');
  const target = validateBackupTarget(raw); raw = '';
  const client = new pg.Client({ host: BACKUP_HOST, port: 5432, user: target.user, password: target.password, database: 'postgres',
    ssl: { ca, rejectUnauthorized: true, servername: BACKUP_HOST }, connectionTimeoutMillis: 12000, query_timeout: 30000,
    application_name: inspect ? 'sinegasi-writer-inspect-readonly' : 'sinegasi-reviewed-reconciliation-writer',
    options: inspect ? '-c default_transaction_read_only=on' : '-c default_transaction_read_only=off' });
  client.on('error', () => {});
  const db: WriterSession = { query: (sql, values) => client.query(sql, values ? [...values] : undefined), inventory: () => databaseInventory(client) };
  try {
    await client.connect(); target.password = '';
    if (inspect) {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL search_path=pg_catalog,public,extensions; SET LOCAL statement_timeout='8s'");
      const catalog = await readWriterCatalog(db);
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ status: 'WRITER_CATALOG_OBSERVATION_ONLY', observedAt: new Date().toISOString(),
        baselineCatalogSha256: writerCatalogHash(catalog), inventorySha256: sha256(JSON.stringify(catalog.inventory)),
        tables: catalog.inventory.tables.length, publicRows: catalog.inventory.tables.reduce((sum, t) => sum + Number(t.rows), 0),
        productionChanged: false, productionApproved: false }));
    } else if (authorization) {
      const result = await runReconciliationWriter(db, bundle, authorization);
      console.log(JSON.stringify({ status: 'WRITER_SCHEMA_AND_CONFIGURATION_VERIFIED', ...result,
        productionChanged: result.mutation !== 'none', accountCreated: false, deploymentPerformed: false,
        fullManagedSchemasVerified: false, readyForPublicLaunch: false }));
    }
  } finally { target.password = ''; await client.end().catch(() => {}); }
}
if (require.main === module) void mainWriter().catch((error: unknown) => {
  const failure = error instanceof WriterError ? error : new WriterError('WRITER_STOPPED_BEFORE_APPLY');
  console.error(JSON.stringify({ status: 'STOP', stage: failure.stage, mutation: failure.mutation,
    productionChanged: failure.mutation === 'unknown' ? 'unknown' : failure.mutation !== 'none',
    inspectCheckpointBeforeRetry: failure.mutation !== 'none' || failure.stage.includes('UNCERTAIN') }));
  process.exitCode = 1;
});
