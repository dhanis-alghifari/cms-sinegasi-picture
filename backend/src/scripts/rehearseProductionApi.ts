import { constants } from 'node:fs';
import { lstat, open, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BackupError, privateCommandBytes } from './productionBackupCore.js';
import { RECONCILIATION_FILES, sha256, verifyCandidateFiles } from './productionReconciliation.js';
import { createReferenceDataPlan } from './productionReferenceData.js';
import { API_EVIDENCE_FILE, parseApiEvidence, requireApiRehearsalArguments } from './productionApiRehearsalCore.js';

const sshArgs = ['-4', '-F', '/dev/null', '-i', '/Users/memberid/.ssh/id_ed25519', '-o', 'IdentitiesOnly=yes',
  '-o', 'PreferredAuthentications=publickey', '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no',
  '-o', 'ConnectTimeout=10', 'ubuntu@43.157.242.8'];
async function ssh(command: string, input: string | Buffer = '', timeout = 30_000): Promise<string> {
  return (await privateCommandBytes('/usr/bin/ssh', [...sshArgs, command], input, timeout, 4 * 1024 * 1024)).toString('utf8');
}

async function compiledFiles(root: string, directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (!/^[A-Za-z0-9_.-]+$/.test(entry.name) || entry.isSymbolicLink()) throw new BackupError('UNSAFE_COMPILED_FILE');
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await compiledFiles(root, name));
    else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) files.push(name);
  }
  return files.sort();
}

async function portableRuntimeFiles(root: string, directory: string): Promise<string[]> {
  const files: string[] = [];
  const excludedDirectories = new Set(['node_modules', 'test', 'tests', '__tests__', 'examples', 'docs', 'benchmarks', '.github']);
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (!/^[A-Za-z0-9_.-]+$/.test(entry.name) || entry.isSymbolicLink()
      || entry.name.startsWith('.env') || entry.name === '.npmrc'
      || /\.(node|so|dylib)$/.test(entry.name)) throw new BackupError('NONPORTABLE_OR_UNSAFE_RUNTIME_PACKAGE');
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) files.push(...await portableRuntimeFiles(root, name));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

async function main(): Promise<void> {
  requireApiRehearsalArguments(process.argv.slice(2));
  if (process.platform !== 'darwin') throw new BackupError('MAC_API_REHEARSAL_REQUIRED');
  process.umask(0o077);
  const repository = resolve(__dirname, '../../..');
  const candidate = await verifyCandidateFiles(repository);
  const reference = createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, 5000);
  const evidencePath = resolve(repository, 'ops', API_EVIDENCE_FILE);
  try { await lstat(evidencePath); throw new BackupError('API_EVIDENCE_ALREADY_EXISTS'); }
  catch (error: unknown) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const dist = resolve(repository, 'backend/dist');
  const backend = resolve(repository, 'backend');
  const lock = JSON.parse(await readFile(resolve(backend, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, { version?: string; dev?: boolean; link?: boolean }>;
  };
  const runtimePackages = Object.entries(lock.packages).filter(([name, value]) => name.startsWith('node_modules/') && !value.dev && value.version);
  const dependencies: Record<string, string> = {};
  const runtimeFiles: string[] = [];
  for (const [name, info] of runtimePackages) {
    if (!/^(?:node_modules\/(?:@[a-z0-9-]+\/)?[a-z0-9_.-]+)(?:\/node_modules\/(?:@[a-z0-9-]+\/)?[a-z0-9_.-]+)*$/.test(name)
      || info.link || (await lstat(resolve(backend, name))).isSymbolicLink()) throw new BackupError('UNSAFE_RUNTIME_PACKAGE_PATH');
    const installed = JSON.parse(await readFile(resolve(backend, name, 'package.json'), 'utf8')) as { version: string };
    if (installed.version !== info.version) throw new BackupError('INSTALLED_RUNTIME_LOCKFILE_MISMATCH');
    dependencies[name.slice('node_modules/'.length)] = installed.version;
    runtimeFiles.push(...await portableRuntimeFiles(backend, name));
  }
  const directories = ['app', 'config', 'middleware', 'modules', 'services', 'shared', 'workers'];
  const files = (await Promise.all(directories.map(directory => compiledFiles(dist, directory)))).flat();
  files.push(...['productionReferenceData', 'productionBackupCore', 'productionReconciliation', 'bootstrapTeacherCore',
    'verifyProductionApi', 'productionApiRehearsalCore'].map(name => `scripts/${name}.js`));
  const base = ['productionBackupCore.js', 'verifyBackupRestore.js', 'productionReconciliation.js', 'verifyProductionReconciliation.js'];
  const ops = ['production-schema.snapshot.json', 'rehearse-schema-reconciliation-vps.sh', 'rehearse-production-api-vps.sh'];
  const entries = [...files.map(file => [file, resolve(dist, file)]),
    ...runtimeFiles.map(file => [file, resolve(backend, file)]),
    ...base.map(file => [file, resolve(dist, 'scripts', file)]),
    ...ops.map(file => [file, resolve(repository, 'ops', file)]),
    ...RECONCILIATION_FILES.map(file => [file, resolve(repository, 'supabase/migrations', file)])];
  const manifest: Array<{ file: string; sha256: string }> = [];
  for (const [file, path] of entries) {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new BackupError('UNSAFE_BUNDLE_FILE');
    manifest.push({ file, sha256: sha256(await readFile(path)) });
  }
  const tar = await privateCommandBytes('/usr/bin/tar', ['-cf', '-', '-C', dist, ...files,
    '-C', backend, ...runtimeFiles,
    '-C', resolve(dist, 'scripts'), ...base, '-C', resolve(repository, 'ops'), ...ops,
    '-C', resolve(repository, 'supabase/migrations'), ...RECONCILIATION_FILES], '', 30_000, 64 * 1024 * 1024);
  const bundle = (await ssh('umask 077; mktemp -d /tmp/sinegasi-schema-rehearsal.XXXXXXXX')).trim();
  if (!/^\/tmp\/sinegasi-schema-rehearsal\.[A-Za-z0-9]+$/.test(bundle)) throw new BackupError('INVALID_REMOTE_BUNDLE');
  const baseCommand = (action: string) => `bash '${bundle}/rehearse-schema-reconciliation-vps.sh' '${action}' '${bundle}'`;
  const apiCommand = (action: string) => `bash '${bundle}/rehearse-production-api-vps.sh' '${action}' '${bundle}'`;
  let resourcePreparationStarted = false;
  let evidence: Record<string, unknown> | undefined;
  try {
    await ssh(`umask 077; tar -xf - -C '${bundle}'`, tar);
    await ssh(`umask 077; dd of='${bundle}/runtime-dependencies.json' status=none`, JSON.stringify(dependencies));
    await ssh(`cd '${bundle}' && sha256sum --check --status`, manifest.map(entry => `${entry.sha256}  ${entry.file}\n`).join(''));
    console.log(JSON.stringify({ stage: 'API_BUNDLE_VERIFIED', modules: files.length, productionCredentialsUsed: false }));
    resourcePreparationStarted = true;
    await ssh(baseCommand('prepare'), '', 60_000);
    await ssh(baseCommand('scaffold'), 'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;');
    console.log(JSON.stringify({ stage: 'API_ISOLATED_DATABASE_PREPARED', bundle }));
    const schema = JSON.parse(await ssh(baseCommand('fresh'), '', 150_000)) as Record<string, unknown>;
    if (schema.status !== 'RECONCILIATION_FRESH_REHEARSAL_PASSED' || schema.packageSha256 !== candidate.fingerprint) {
      throw new BackupError('API_SCHEMA_REHEARSAL_FAILED');
    }
    await ssh(apiCommand('prepare'), '', 30_000);
    console.log(JSON.stringify({ stage: 'POSTGREST_STARTED_NO_PUBLIC_PORTS' }));
    // Verifier exit 1 carries sanitized failure JSON; timeouts/other exit codes remain hard failures.
    const output = await ssh(`${apiCommand('verify')} || test $? -eq 1`, '', 150_000);
    // Forward only the sanitized stage/check output if the verifier fails.
    try { evidence = parseApiEvidence(output, candidate.fingerprint, reference.checksum); }
    catch { console.log(output.trim()); throw new BackupError('API_REHEARSAL_NOT_PASSED'); }
    evidence.bundleSha256 = sha256(JSON.stringify(manifest));
    evidence.moduleCount = files.length;
    evidence.runtimeDependencyCount = runtimePackages.length;
    evidence.runtimeDependenciesSha256 = sha256(JSON.stringify(dependencies));
    evidence.schemaChecks = schema;
  } finally {
    if (resourcePreparationStarted) {
      const cleanup = (await ssh(apiCommand('cleanup'), '', 30_000)).trim();
      if (cleanup !== 'API_CLEANUP_DEV_CADDY_UNCHANGED') throw new BackupError('API_CLEANUP_NOT_VERIFIED');
      console.log(JSON.stringify({ stage: 'API_DISPOSABLE_REMOVED', devCaddyUnchanged: true }));
    } else {
      // No resources exist yet; remove a partial upload only from the validated task directory.
      await ssh(`test -d '${bundle}' && test ! -L '${bundle}' && test "$(stat -c '%U:%a' '${bundle}')" = ubuntu:700 && rm -r -- '${bundle}'`);
    }
  }
  if (!evidence) throw new BackupError('API_REHEARSAL_NOT_VERIFIED');
  evidence.cleanupVerified = true;
  evidence.verifiedAt = new Date().toISOString();
  const handle = await open(evidencePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(JSON.stringify(evidence, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  console.log(JSON.stringify({ ...evidence, evidencePath }));
}
if (require.main === module) void main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof BackupError ? error.stage : 'API_REHEARSAL_FAILED', productionChanged: false }));
  process.exitCode = 1;
});
