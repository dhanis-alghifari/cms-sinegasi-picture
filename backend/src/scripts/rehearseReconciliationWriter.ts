import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { privateCommandBytes } from './productionBackupCore.js';
import { RECONCILIATION_FILES, sha256 } from './productionReconciliation.js';
import { loadPreflightPlan } from './productionReconciliationPreflightCore.js';
import { writerSourceHash } from './reconciliationWriter.js';
import { createWriterPackage, validateWriterEvidence, WriterError } from './reconciliationWriterPolicy.js';
import { bootstrapSourceHash } from './productionBootstrapTeacher.js';
import { BOOTSTRAP_GUARD_CHECKS } from './productionBootstrapTeacherCore.js';

const SSH_ARGS = ['-4', '-F', '/dev/null', '-i', '/Users/memberid/.ssh/id_ed25519', '-o', 'IdentitiesOnly=yes',
  '-o', 'PreferredAuthentications=publickey', '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no',
  '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'ubuntu@43.157.242.8'];
const WRITER_FILES = ['reconciliationWriterCore.js', 'reconciliationWriterCatalog.js', 'reconciliationWriterPolicy.js',
  'reconciliationWriterExtensions.js',
  'reconciliationWriterFixtures.js', 'verifyReconciliationWriter.js', 'productionReferenceData.js', 'productionReconciliation.js',
  'productionBackupCore.js', 'productionReconciliationPreflightCore.js', 'productionApiRehearsalCore.js', 'migrationSafety.js',
  'productionBootstrapTeacherCore.js', 'productionBootstrapTeacherFixtures.js', 'verifyProductionBootstrapTeacher.js',
  'bootstrapTeacherCore.js', 'bootstrapTeacherCredentials.js'];
const ssh = async (command: string, input: Buffer | string = '', timeout = 30000): Promise<string> =>
  (await privateCommandBytes('/usr/bin/ssh', [...SSH_ARGS, command], input, timeout, 4 * 1024 * 1024)).toString('utf8');

async function main(): Promise<void> {
  if (process.platform !== 'darwin' || process.argv.length !== 3 || !['rehearse-writer', 'rehearse-bootstrap'].includes(process.argv[2])) throw new WriterError('MAC_ISOLATED_WRITER_REHEARSAL_REQUIRED');
  const bootstrap = process.argv[2] === 'rehearse-bootstrap';
  process.umask(0o077);
  const repository = resolve(__dirname, '../../..');
  const { snapshot, plan } = await loadPreflightPlan(repository);
  const bundle = createWriterPackage(snapshot), hashSource = bootstrap ? bootstrapSourceHash : writerSourceHash;
  const sourceSha256 = await hashSource(repository);
  const remote = (await ssh('umask 077; mktemp -d /tmp/sinegasi-schema-rehearsal.XXXXXXXX')).trim();
  if (!/^\/tmp\/sinegasi-schema-rehearsal\.[A-Za-z0-9]+$/.test(remote)) throw new WriterError('UNSAFE_REMOTE_TEST_BUNDLE');
  const action = (name: string) => `bash '${remote}/rehearse-schema-reconciliation-vps.sh' '${name}' '${remote}'`;
  let prepared = false, receipt: Record<string, unknown> | undefined;
  const artifacts: [string, string][] = [
    ...['productionBackupCore.js', 'verifyBackupRestore.js', 'productionReconciliation.js', 'verifyProductionReconciliation.js'].map(file => [file, 'backend/dist/scripts/' + file] as [string, string]),
    ['production-schema.snapshot.json', 'ops/production-schema.snapshot.json'],
    ...RECONCILIATION_FILES.map(file => [file, 'supabase/migrations/' + file] as [string, string]),
    ['rehearse-schema-reconciliation-vps.sh', 'ops/rehearse-schema-reconciliation-vps.sh'],
    ...WRITER_FILES.map(file => ['scripts/' + file, 'backend/dist/scripts/' + file] as [string, string]),
    ['middleware/capabilities.js', 'backend/dist/middleware/capabilities.js'],
  ];
  try {
    await ssh(`umask 077; mkdir '${remote}/scripts' '${remote}/middleware' '${remote}/services'`);
    artifacts.push(['services/passwordService.js', 'backend/dist/services/passwordService.js']);
    // Bound concurrency: avoid saturating sshd or the shared VPS.
    for (let index = 0; index < artifacts.length; index += 3) {
      await Promise.all(artifacts.slice(index, index + 3).map(async ([file, path]) => {
        const bytes = await readFile(resolve(repository, path));
        await ssh(`umask 077; test ! -e '${remote}/${file}' && dd of='${remote}/${file}' status=none`, bytes);
        if ((await ssh(`sha256sum '${remote}/${file}'`)).split(' ')[0] !== sha256(bytes)) throw new WriterError('REMOTE_TEST_ARTIFACT_CHANGED');
      }));
    }
    prepared = true;
    await ssh(action('prepare'), '', 60000);
    console.log(JSON.stringify({ stage: 'ISOLATED_WRITER_TEST_PREPARED', productionCredentialsUsed: false, portsPublished: false, bundle: remote }));
    const result: unknown = JSON.parse(await ssh(action(bootstrap ? 'bootstrap' : 'writer'), '', 250000));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new WriterError('INVALID_WRITER_TEST_RESULT');
    receipt = { ...result, cleanupVerified: true };
    if (receipt.status !== (bootstrap ? 'BOOTSTRAP_GUARD_ISOLATED_PASSED' : 'RECONCILIATION_WRITER_ISOLATED_PASSED')) {
      console.error(JSON.stringify({ status: 'ISOLATED_TEST_FAILURE',
        stage: typeof receipt.stage === 'string' && /^[A-Z_]+$/.test(receipt.stage) ? receipt.stage : 'UNKNOWN',
        check: typeof receipt.check === 'string' && /^[A-Z_]+$/.test(receipt.check) ? receipt.check : 'UNKNOWN', code: receipt.code,
        routine: receipt.routine, writerFailureStage: receipt.writerFailureStage, writerMutation: receipt.writerMutation }));
      throw new WriterError('ISOLATED_WRITER_TESTS_NOT_PASSED');
    }
    if (bootstrap) {
      const checks = receipt.checks;
      if (!checks || typeof checks !== 'object' || Array.isArray(checks)
        || BOOTSTRAP_GUARD_CHECKS.some(key => (checks as Record<string, unknown>)[key] !== true)
        || receipt.packageSha256 !== bundle.packageSha256) throw new WriterError('BOOTSTRAP_GUARD_CHECKS_INCOMPLETE');
    } else validateWriterEvidence(receipt, bundle);
  } finally {
    if (prepared) {
      try { await ssh(action('cleanup')); console.log(JSON.stringify({ stage: 'DISPOSABLE_REMOVED', devCaddyUnchanged: true })); }
      catch { throw new WriterError('DISPOSABLE_CLEANUP_REQUIRED'); }
    }
  }
  if (!receipt) throw new WriterError('WRITER_TESTS_NOT_VERIFIED');
  if (sourceSha256 !== await hashSource(repository)) throw new WriterError('SOURCE_CHANGED_DURING_TEST');
  const verifiedAt = new Date().toISOString();
  receipt = { ...receipt, runnerSourceSha256: sourceSha256, priorEvidenceSha256: plan.evidenceSha256, verifiedAt, cleanupVerified: true };
  const prefix = bootstrap ? 'production-bootstrap.rehearsal' : 'production-reconciliation.writer-rehearsal';
  const path = resolve(repository, 'ops', `${prefix}.${verifiedAt.replace(/[:.]/g, '-')}.json`);
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(JSON.stringify(receipt, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
  console.log(JSON.stringify({ ...receipt, evidenceFile: path }));
}
if (require.main === module) void main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof WriterError ? error.stage : 'ISOLATED_WRITER_REHEARSAL_FAILED', productionChanged: false }));
  process.exitCode = 1;
});
