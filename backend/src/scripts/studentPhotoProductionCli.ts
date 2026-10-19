import { constants } from 'node:fs';
import { lstat, open, type FileHandle } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { BACKUP_HOST, databaseInventory, readGithubMainSha, readGithubProductionProtection, readGithubQualityMetadata,
  validateBackupCa, validateBackupTarget } from './productionBackupCore.js';
import { readGateDocument } from './productionDeploymentGateCli.js';
import { DEPLOYMENT_PROJECT, requireDeploymentQuality, requireProductionEnvironment, validateDeploymentEvidence } from './productionDeploymentGate.js';
import { createWriterPackage } from './reconciliationWriterPolicy.js';
import { validateSnapshot } from './productionReconciliation.js';
import { STUDENT_PHOTO_CHANGE, STUDENT_PHOTO_SQL_SHA256, readStudentPhotoSql, studentPhotoHash } from './studentPhotoProductionPolicy.js';
import { applyStudentPhotoMigration, validateStudentPhotoApproval, type StudentPhotoAuthorization } from './studentPhotoProductionMigration.js';

async function replaceReceipt(output: FileHandle, raw: string): Promise<void> {
  const bytes = Buffer.from(raw);
  let position = 0;
  while (position < bytes.length) {
    const result = await output.write(bytes, position, bytes.length - position, position);
    if (result.bytesWritten < 1) throw new Error('RECEIPT_WRITE_INCOMPLETE');
    position += result.bytesWritten;
  }
  await output.truncate(bytes.length);
  await output.sync();
}

/** No dotenv/Keychain import, credential copying, automatic approval, deployment or generic SQL. */
export async function runStudentPhotoProduction(args: readonly string[]): Promise<void> {
  if (args.length === 1 && args[0] === 'plan') {
    await readStudentPhotoSql();
    console.log(JSON.stringify({ operation: STUDENT_PHOTO_CHANGE, sqlSha256: STUDENT_PHOTO_SQL_SHA256,
      databaseAccessed: false, productionChanged: false, deploymentPerformed: false, approvalCreated: false }));
    return;
  }
  const flags = ['--approval', '--confirm-approval', '--baseline', '--confirm-baseline', '--rehearsal', '--snapshot',
    '--release-sha', '--connection', '--receipt', '--confirm-project'];
  if (args[0] !== 'apply' || args.length !== 1 + flags.length * 2) throw new Error('EXPLICIT_PHOTO_MIGRATION_MODE_REQUIRED');
  const values: Record<string, string> = {};
  for (let index = 1; index < args.length; index += 2) {
    if (!flags.includes(args[index]) || Object.hasOwn(values, args[index]) || !args[index + 1]) throw new Error('INVALID_PHOTO_MIGRATION_FLAGS');
    values[args[index]] = args[index + 1];
  }
  if (process.platform !== 'darwin' || !__filename.endsWith('.ts') || process.env.ENV_FILE_LOADING !== 'disabled'
    || values['--confirm-project'] !== DEPLOYMENT_PROJECT) throw new Error('REVIEWED_MAC_SOURCE_RUNNER_REQUIRED');
  const root = resolve(__dirname, '../../..');
  const git = (...arguments_: string[]): string => execFileSync('/usr/bin/git', ['-C', root, ...arguments_],
    { encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git('rev-parse', 'HEAD') !== values['--release-sha'] || git('status', '--porcelain') !== '') throw new Error('EXACT_CLEAN_RELEASE_REQUIRED');
  if (resolve(values['--snapshot']) !== resolve(root, 'ops/production-schema.snapshot.json')) throw new Error('FIXED_SNAPSHOT_REQUIRED');
  const snapshotRaw = await readGateDocument(values['--snapshot'], false);
  const snapshot: unknown = JSON.parse(snapshotRaw); validateSnapshot(snapshot);
  const bundle = createWriterPackage(snapshot);
  const baselineRaw = await readGateDocument(values['--baseline'], true);
  const context = { releaseSha: values['--release-sha'], evidenceSha256: values['--confirm-baseline'],
    snapshotSha256: studentPhotoHash(snapshotRaw), packageSha256: bundle.packageSha256 };
  const baseline = validateDeploymentEvidence(baselineRaw, { ...context, now: Date.now() });
  const approvalRaw = await readGateDocument(values['--approval'], true);
  const protection = await readGithubProductionProtection();
  requireProductionEnvironment(protection.environment, protection.branches, baseline.reviewPolicy);
  const rehearsalRaw = await readGateDocument(values['--rehearsal'], true);
  const auth: StudentPhotoAuthorization = { approvalRaw, confirmApproval: values['--confirm-approval'], baselineRaw,
    rehearsalRaw, context };
  const { approval } = validateStudentPhotoApproval(auth, Date.now());
  async function revalidate(): Promise<void> {
    const [main, quality, current] = await Promise.all([
      readGithubMainSha(), readGithubQualityMetadata(approval.qualityRunId), readGithubProductionProtection(),
    ]);
    requireDeploymentQuality(quality.run, quality.jobs, context.releaseSha, { sha: main });
    requireProductionEnvironment(current.environment, current.branches, baseline.reviewPolicy);
    if (!current.migrationReady || current.reviewMode !== baseline.reviewPolicy.mode) throw new Error('PHOTO_MIGRATION_NOT_ENABLED');
    if (git('rev-parse', 'HEAD') !== context.releaseSha || git('status', '--porcelain') !== '') throw new Error('RELEASE_CHANGED');
  }
  await revalidate(); // No connection credential is read before quality/protection/approval.
  const connection = JSON.parse(await readGateDocument(values['--connection'], true)) as Record<string, unknown>;
  if (Object.keys(connection).length !== 2 || typeof connection.postgresUrl !== 'string' || typeof connection.ca !== 'string') {
    throw new Error('INVALID_PHOTO_MIGRATION_CONNECTION');
  }
  const target = validateBackupTarget(connection.postgresUrl); validateBackupCa(connection.ca);
  const receiptPath = resolve(values['--receipt']);
  const parent = await lstat(dirname(receiptPath));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid?.() || (parent.mode & 0o777) !== 0o700) {
    throw new Error('PRIVATE_RECEIPT_DIRECTORY_REQUIRED');
  }
  const receiptDirectory = await open(dirname(receiptPath), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let output: FileHandle | undefined;
  let client: pg.Client | undefined;
  try {
    output = await open(receiptPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const info = await output.stat();
    if (!info.isFile() || info.uid !== process.getuid?.() || info.nlink !== 1 || (info.mode & 0o777) !== 0o600) {
      throw new Error('PRIVATE_EXCLUSIVE_RECEIPT_REQUIRED');
    }
    client = new pg.Client({ host: BACKUP_HOST, port: 5432, database: 'postgres', user: target.user, password: target.password,
      ssl: { ca: connection.ca, rejectUnauthorized: true, servername: BACKUP_HOST }, connectionTimeoutMillis: 12_000,
      query_timeout: 12_000, options: '-c default_transaction_read_only=off', application_name: 'sinegasi-reviewed-photo-migration' });
    client.on('error', () => {});
    await replaceReceipt(output, JSON.stringify({ status: 'ATTEMPT_PENDING_DO_NOT_RETRY', operation: STUDENT_PHOTO_CHANGE,
      approvalSha256: auth.confirmApproval, releaseSha: context.releaseSha }));
    await receiptDirectory.sync();
    await client.connect();
    const connected = client;
    const receipt = await applyStudentPhotoMigration({ query: (sql, parameters) => connected.query(sql, parameters ? [...parameters] : undefined),
      inventory: () => databaseInventory(connected) }, bundle, auth, { now: Date.now, revalidate });
    const raw = JSON.stringify(receipt);
    await replaceReceipt(output, raw);
    console.log(JSON.stringify({ status: 'STUDENT_PHOTO_MIGRATION_COMMITTED', receiptSha256: studentPhotoHash(raw), deploymentPerformed: false }));
  } finally {
    await client?.end().catch(() => {});
    await output?.close();
    await receiptDirectory.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  void runStudentPhotoProduction(process.argv.slice(2)).catch(() => {
    console.error('STOP: PHOTO_MIGRATION_FAILED_OR_COMMIT_RECEIPT_UNCERTAIN; inspect private attempt and database before retry. No details logged.');
    process.exitCode = 1;
  });
}
