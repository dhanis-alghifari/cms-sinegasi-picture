import { readFile, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  AGE, AGE_KEYGEN, BACKUP_PROJECT, BACKUP_ROOT, BACKUP_KEY_SERVICE,
  BackupError, type DatabaseInventory, privateCommandBytes, privateCommand,
  privateDirectory, quoteIdentifier, readKeychain, listBackupArchive,
} from './productionBackupCore.js';

const SSH_ARGS = [
  '-4', '-F', '/dev/null', '-i', '/Users/memberid/.ssh/id_ed25519',
  '-o', 'IdentitiesOnly=yes', '-o', 'PreferredAuthentications=publickey',
  '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no', '-o', 'ConnectTimeout=10',
  'ubuntu@43.157.242.8',
];

async function ssh(command: string, input: Buffer | string = '', timeout = 30_000): Promise<string> {
  return (await privateCommandBytes('/usr/bin/ssh', [...SSH_ARGS, command], input, timeout, 4 * 1024 * 1024)).toString('utf8');
}

function digest(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }

async function artifact(path: string): Promise<Buffer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid?.()
    || (info.mode & 0o777) !== 0o600 || info.size > 256 * 1024 * 1024) throw new BackupError('UNSAFE_BACKUP_ARTIFACT');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return await handle.readFile(); } finally { await handle.close(); }
}

async function main(): Promise<void> {
  const id = process.argv[2];
  if (process.platform !== 'darwin' || process.argv.length !== 3 || !/^[0-9TZ-]+$/.test(id ?? '')) {
    throw new BackupError('USE_EXACT_BACKUP_ID_ON_MAC');
  }
  process.umask(0o077);
  const directory = BACKUP_ROOT + '/' + id;
  await privateDirectory(directory);
  const receipt = JSON.parse((await artifact(directory + '/receipt.json')).toString('utf8')) as {
    project: string; id: string; archive: { sha256: string }; metadata: { sha256: string }; recipient: string;
  };
  const encrypted = await artifact(directory + '/database.dump.age');
  const encryptedMetadata = await artifact(directory + '/metadata.json.age');
  if (receipt.project !== BACKUP_PROJECT || receipt.id !== id || digest(encrypted) !== receipt.archive.sha256
    || digest(encryptedMetadata) !== receipt.metadata.sha256) throw new BackupError('BACKUP_INTEGRITY_FAILED');
  console.log(JSON.stringify({ stage: 'BACKUP_KEYCHAIN_ALLOW_REQUIRED', encryptedBackupIntegrity: true }));
  let identity = (await readKeychain(BACKUP_KEY_SERVICE, BACKUP_PROJECT)).trim();
  if (!/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(identity)) throw new BackupError('INVALID_BACKUP_IDENTITY');
  if ((await privateCommand(AGE_KEYGEN, ['-y'], identity + '\n')).trim() !== receipt.recipient) throw new BackupError('BACKUP_RECIPIENT_MISMATCH');
  const archive = await privateCommandBytes(AGE, ['--decrypt', '-i', '-', directory + '/database.dump.age'], identity + '\n', 30000, 256 * 1024 * 1024);
  const metadataBytes = await privateCommandBytes(AGE, ['--decrypt', '-i', '-', directory + '/metadata.json.age'], identity + '\n');
  identity = '';
  const metadata = JSON.parse(metadataBytes.toString('utf8')) as { project: string; id: string; sourceVersion: string; inventory: DatabaseInventory };
  metadataBytes.fill(0);
  if (metadata.project !== BACKUP_PROJECT || metadata.id !== id || !Array.isArray(metadata.inventory?.tables)
    || !Array.isArray(metadata.inventory?.structure) || !Array.isArray(metadata.inventory?.roles)
    || !Array.isArray(metadata.inventory?.extensions)) throw new BackupError('INVALID_BACKUP_METADATA');
  if (!archive.subarray(0, 5).equals(Buffer.from('PGDMP'))) throw new BackupError('INVALID_POSTGRES_ARCHIVE');
  const localList = await listBackupArchive(archive);
  if (!localList.toString('utf8').includes(' TABLE public users ')) throw new BackupError('APPLICATION_TABLE_MISSING');
  const repository = resolve(process.cwd(), '..');
  const bundle = (await ssh('umask 077; mktemp -d /tmp/sinegasi-backup-restore.XXXXXXXX')).trim();
  if (!/^\/tmp\/sinegasi-backup-restore\.[A-Za-z0-9]+$/.test(bundle)) throw new BackupError('INVALID_REMOTE_BUNDLE');
  let prepared = false;
  let completed = false;
  let cleaned = false;
  try {
    for (const [file, path] of [
      ['productionBackupCore.js', repository + '/backend/dist/scripts/productionBackupCore.js'],
      ['verifyBackupRestore.js', repository + '/backend/dist/scripts/verifyBackupRestore.js'],
      ['rehearse-backup-restore-vps.sh', repository + '/ops/rehearse-backup-restore-vps.sh'],
    ]) {
      const bytes = await readFile(path);
      await ssh(`umask 077; test ! -e '${bundle}/${file}' && dd of='${bundle}/${file}' status=none`, bytes);
      const remoteHash = (await ssh(`sha256sum '${bundle}/${file}'`)).split(' ')[0];
      if (remoteHash !== digest(bytes)) throw new BackupError('REMOTE_SCRIPT_HASH_MISMATCH');
    }
    const command = (action: string) => `bash '${bundle}/rehearse-backup-restore-vps.sh' '${action}' '${bundle}'`;
    // Set before prepare: interrupted initialization must also be cleaned.
    prepared = true;
    await ssh(command('prepare'), '', 60000);
    console.log(JSON.stringify({ stage: 'ISOLATED_RESTORE_PREPARED', bundle }));
    await ssh(command('upload'), archive, 60000);
    archive.fill(0);
    const roleSql = metadata.inventory.roles.filter((role) => role.name !== 'postgres').map((role) =>
      `CREATE ROLE ${quoteIdentifier(role.name)} NOLOGIN ${role.inherit ? 'INHERIT' : 'NOINHERIT'} ${role.bypassRls ? 'BYPASSRLS' : 'NOBYPASSRLS'};`);
    const extensions = metadata.inventory.extensions.filter((extension) =>
      ['pg_trgm', 'pgcrypto', 'uuid-ossp'].includes(extension.name));
    const extensionSql = extensions.flatMap((extension) => [
      `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(extension.schema)};`,
      `CREATE EXTENSION ${quoteIdentifier(extension.name)} WITH SCHEMA ${quoteIdentifier(extension.schema)};`,
    ]);
    await ssh(command('scaffold'), ['BEGIN;', ...roleSql, ...extensionSql, 'COMMIT;'].join('\n'));
    await ssh(command('restore'), '', 60000);
    const result = JSON.parse(await ssh(command('verify'))) as { version: string; inventory: DatabaseInventory };
    const checks = {
      tableRowsAndRlsMatch: JSON.stringify(result.inventory.tables) === JSON.stringify(metadata.inventory.tables),
      columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch:
        JSON.stringify(result.inventory.structure) === JSON.stringify(metadata.inventory.structure),
      publicExtensionsMatch: JSON.stringify(result.inventory.extensions.filter((entry) => entry.schema === 'public'))
        === JSON.stringify(metadata.inventory.extensions.filter((entry) => entry.schema === 'public')),
    };
    if (Object.values(checks).some((check) => !check)) {
      console.log(JSON.stringify({ status: 'RESTORE_VERIFICATION_FAILED', checks }));
      throw new BackupError('RESTORE_CATALOG_MISMATCH');
    }
    completed = true;
    const record = {
      status: 'PUBLIC_APPLICATION_RESTORE_VERIFIED', project: BACKUP_PROJECT, id,
      sourceVersion: metadata.sourceVersion, rehearsalVersion: result.version,
      archiveSha256: receipt.archive.sha256, tables: result.inventory.tables.length, checks,
      allManagedSupabaseSchemasRestoreVerified: false, productionSqlPackageValidated: false,
      offDeviceRecoveryCopyVerified: false, productionChanged: false,
    };
    const handle = await open(directory + '/public-restore-verification.json', constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(JSON.stringify(record, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    console.log(JSON.stringify(record));
  } finally {
    archive.fill(0);
    if (prepared) {
      try {
        await ssh(`bash '${bundle}/rehearse-backup-restore-vps.sh' cleanup '${bundle}'`, '', 30000);
        cleaned = true;
        console.log(JSON.stringify({ stage: 'DISPOSABLE_REMOVED', devCaddyUnchanged: true, encryptedBackupRetained: true }));
      } catch {
        console.log(JSON.stringify({ status: 'DISPOSABLE_CLEANUP_REQUIRED', bundle }));
      }
    }
    if (!cleaned || !completed) throw new BackupError(cleaned ? 'RESTORE_REHEARSAL_FAILED' : 'RESTORE_CLEANUP_NOT_VERIFIED');
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof BackupError ? error.stage : 'RESTORE_REHEARSAL_FAILED', productionChanged: false }));
  process.exitCode = 1;
});
