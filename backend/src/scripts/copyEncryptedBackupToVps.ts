import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BACKUP_PROJECT, BACKUP_ROOT, BackupError, privateCommandBytes } from './productionBackupCore.js';

export const COPY_FILES = ['database.dump.age', 'metadata.json.age', 'receipt.json', 'public-restore-verification.json'] as const;
type CopyFile = typeof COPY_FILES[number];
const SSH_ARGS = ['-4', '-F', '/dev/null', '-i', '/Users/memberid/.ssh/id_ed25519',
  '-o', 'IdentitiesOnly=yes', '-o', 'PreferredAuthentications=publickey', '-o', 'StrictHostKeyChecking=yes',
  '-o', 'UpdateHostKeys=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'ubuntu@43.157.242.8'];
const SNAPSHOT = 'test "$(id -un)" = ubuntu && test "$(hostname)" = VM-11-154-ubuntu && '
  + 'docker inspect sinegasi-api-dev caddy-proxy --format \'{{.Name}} {{.Id}} {{.State.Running}} {{.RestartCount}} {{.State.StartedAt}}\'';
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

export function validateCopyId(id: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(id)) throw new BackupError('INVALID_BACKUP_ID');
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BackupError('INVALID_BACKUP_RECEIPT');
  return value as Record<string, unknown>;
}

export function validateCopyArtifacts(id: string, files: Readonly<Record<CopyFile, Buffer>>): void {
  validateCopyId(id);
  try {
    const receipt = object(JSON.parse(files['receipt.json'].toString('utf8')));
    const restore = object(JSON.parse(files['public-restore-verification.json'].toString('utf8')));
    for (const [name, key] of [['database.dump.age', 'archive'], ['metadata.json.age', 'metadata']] as const) {
      const expected = object(receipt[key]);
      if (hash(files[name]) !== expected.sha256 || files[name].length !== expected.bytes
        || !files[name].subarray(0, 22).equals(Buffer.from('age-encryption.org/v1\n'))) throw new Error();
    }
    const checks = object(restore.checks);
    if (receipt.project !== BACKUP_PROJECT || receipt.id !== id || receipt.encrypted !== true
      || receipt.productionChanged !== false || restore.project !== BACKUP_PROJECT || restore.id !== id
      || restore.status !== 'PUBLIC_APPLICATION_RESTORE_VERIFIED' || restore.productionChanged !== false
      || restore.archiveSha256 !== object(receipt.archive).sha256
      || checks.tableRowsAndRlsMatch !== true || checks.columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch !== true
      || checks.publicExtensionsMatch !== true) throw new Error();
  } catch { throw new BackupError('BACKUP_INTEGRITY_OR_RESTORE_PROOF_FAILED'); }
}

export async function readCopyArtifact(path: string): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o600
      || info.nlink !== 1 || info.size < 1 || info.size > 256 * 1024 * 1024) throw new BackupError('UNSAFE_BACKUP_ARTIFACT');
    return await handle.readFile();
  } finally { await handle.close(); }
}

export function quoteCopyShell(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }

async function ssh(command: string, input: Buffer | string = ''): Promise<string> {
  return (await privateCommandBytes('/usr/bin/ssh', [...SSH_ARGS, command], input, 60_000)).toString('utf8').trim();
}

export async function mainCopyEncryptedBackup(args = process.argv.slice(2)): Promise<void> {
  if (process.platform !== 'darwin' || !(args.length === 1 || (args.length === 2 && args[1] === '--resume-empty'))) {
    throw new BackupError('USE_EXACT_BACKUP_ID_ON_MAC');
  }
  const id = args[0];
  validateCopyId(id);
  process.umask(0o077);
  const directory = `${BACKUP_ROOT}/${id}`;
  for (const path of ['/Users/memberid/Library/Application Support', '/Users/memberid/Library/Application Support/Sinegasi', BACKUP_ROOT, directory]) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.()
      || (path !== '/Users/memberid/Library/Application Support' && (info.mode & 0o777) !== 0o700)) {
      throw new BackupError('UNSAFE_BACKUP_DIRECTORY');
    }
  }
  const files = Object.fromEntries(await Promise.all(COPY_FILES.map(async (name) =>
    [name, await readCopyArtifact(`${directory}/${name}`)] as const))) as Record<CopyFile, Buffer>;
  validateCopyArtifacts(id, files);
  // Fail before VPS changes if this operation already has a local verification record.
  try { await lstat(`${directory}/vps-copy-verification.json`); throw new BackupError('COPY_ALREADY_RECORDED'); }
  catch (error: unknown) { if (!object(error).code || object(error).code !== 'ENOENT') throw error; }
  const receiver = await readFile(resolve(__dirname, '../../../ops/copy-encrypted-backup-vps.sh'), 'utf8');
  const remote = (action: string, name?: string, bytes?: Buffer): string =>
    `test "$(id -un)" = ubuntu && test "$(hostname)" = VM-11-154-ubuntu && sudo -n /bin/bash -c ${quoteCopyShell(receiver)} -- `
    + [action, id, ...(name && bytes ? [name, hash(bytes), String(bytes.length)] : [])].map(quoteCopyShell).join(' ');
  const before = await ssh(SNAPSHOT);
  if (!/^\/sinegasi-api-dev [a-f0-9]{64} true \d+ .+\n\/caddy-proxy [a-f0-9]{64} true \d+ .+$/.test(before)) {
    throw new BackupError('DEV_CADDY_NOT_RUNNING');
  }
  if (await ssh(remote(args[1] === '--resume-empty' ? 'resume-empty' : 'init')) !== 'DESTINATION_CREATED') {
    throw new BackupError('VPS_DIRECTORY_FAILED');
  }
  console.log(JSON.stringify({ stage: 'PRIVATE_VPS_DIRECTORY_CREATED', id, secretsTransferred: false }));
  for (const name of COPY_FILES) {
    if (await ssh(remote('upload', name, files[name]), files[name]) !== 'FILE_VERIFIED') throw new BackupError('VPS_UPLOAD_FAILED');
  }
  for (const name of COPY_FILES) {
    if (await ssh(remote('verify', name, files[name])) !== 'FILE_VERIFIED') throw new BackupError('VPS_READBACK_FAILED');
  }
  if (await ssh(SNAPSHOT) !== before) throw new BackupError('DEV_CADDY_CHANGED');
  const record = {
    status: 'ENCRYPTED_VPS_COPY_VERIFIED', project: BACKUP_PROJECT, id, verifiedAt: new Date().toISOString(),
    host: '43.157.242.8', destination: `/opt/sinegasi-backups/production/${id}`,
    files: COPY_FILES.map((name) => ({ name, sha256: hash(files[name]), bytes: files[name].length })),
    directoryMode: '0700', fileMode: '0600', owner: 'root', offDeviceBackupCopyVerified: true,
    decryptionKeyTransferred: false, databaseCredentialsTransferred: false, independentRecoveryKeyCopyVerified: false,
    sameHostAsApplication: true, automaticBackupScheduled: false, allManagedSupabaseSchemasRestoreVerified: false,
    productionSqlPackageValidated: false, devCaddyUnchanged: true, productionChanged: false,
  };
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + '\n');
  if (await ssh(remote('upload', 'vps-copy-verification.json', bytes), bytes) !== 'FILE_VERIFIED'
    || await ssh(SNAPSHOT) !== before) throw new BackupError('VPS_VERIFICATION_RECORD_FAILED');
  const handle = await open(`${directory}/vps-copy-verification.json`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  console.log(JSON.stringify(record));
}

if (typeof require !== 'undefined' && require.main === module) {
  void mainCopyEncryptedBackup().catch((error: unknown) => {
    console.error(JSON.stringify({ status: 'STOP', stage: error instanceof BackupError ? error.stage : 'VPS_COPY_FAILED',
      incompleteRemoteDirectoryMayRemain: true, productionChanged: false }));
    process.exitCode = 1;
  });
}
