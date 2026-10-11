import { spawn } from 'node:child_process';
import { readFile, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { Readable } from 'node:stream';
import pg from 'pg';
import {
  AGE, BACKUP_HOST, BACKUP_PROJECT, BACKUP_ROOT, PG_DUMP, SAFE_ENV,
  BackupError, backupIdentity, databaseInventory, encryptStream,
  privateCommand, privateDirectory, readKeychain, validateBackupCa, validateBackupTarget,
} from './productionBackupCore.js';

const CA_PATH = '/Users/memberid/Downloads/prod-ca-2021.crt';

async function main(): Promise<void> {
  if (process.platform !== 'darwin' || process.argv.length !== 3 || process.argv[2] !== 'create') {
    throw new BackupError('USE_ON_MAC_WITH_CREATE');
  }
  process.umask(0o077);
  const caInfo = await lstat(CA_PATH);
  if (!caInfo.isFile() || caInfo.isSymbolicLink() || caInfo.size > 32768) throw new BackupError('UNSAFE_CA_FILE');
  const ca = await readFile(CA_PATH, 'utf8');
  validateBackupCa(ca);
  if (!(await privateCommand(PG_DUMP, ['--version'])).includes(' 17.11')) throw new BackupError('PG_CLIENT_VERSION_MISMATCH');
  if ((await privateCommand(AGE, ['--version'])).trim() !== 'v1.3.2') throw new BackupError('AGE_VERSION_MISMATCH');
  console.log(JSON.stringify({ stage: 'KEYCHAIN_ADMIN_READ_REQUIRED', productionChanged: false }));
  let raw = await readKeychain('sinegasi-prod-postgres-admin-url', 'postgres');
  const target = validateBackupTarget(raw);
  raw = '';
  const client = new pg.Client({
    host: BACKUP_HOST, port: 5432, database: 'postgres', user: target.user, password: target.password,
    ssl: { ca, rejectUnauthorized: true, servername: BACKUP_HOST },
    connectionTimeoutMillis: 12000, query_timeout: 10000,
    application_name: 'sinegasi-encrypted-backup-readonly',
    options: '-c default_transaction_read_only=on',
  });
  client.on('error', () => {});
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '8s'");
    const info = (await client.query<{ database: string; user: string; readOnly: string; version: string }>(
      `SELECT current_database() AS database,current_user AS user,current_setting('transaction_read_only') AS "readOnly",current_setting('server_version') AS version`)).rows[0];
    if (info.database !== 'postgres' || info.user !== 'postgres' || info.readOnly !== 'on' || !info.version.startsWith('17.')) {
      throw new BackupError('SOURCE_READONLY_IDENTITY_FAILED');
    }
    const inventory = await databaseInventory(client);
    const snapshot = (await client.query<{ snapshot: string }>('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    if (!/^[0-9A-F-]+$/i.test(snapshot)) throw new BackupError('INVALID_BACKUP_SNAPSHOT');
    console.log(JSON.stringify({ stage: 'KEYCHAIN_BACKUP_KEY_REQUIRED', tables: inventory.tables.length, totalPublicRows: inventory.tables.reduce((sum, table) => sum + Number(table.rows), 0) }));
    const key = await backupIdentity();
    const id = new Date().toISOString().replace(/[:.]/g, '-');
    const directory = `${BACKUP_ROOT}/${id}`;
    await privateDirectory(directory);
    const dump = spawn(PG_DUMP, [
      '--host', BACKUP_HOST, '--port', '5432', '--username', target.user, '--dbname', 'postgres',
      '--password', '--format=custom', '--compress=6', '--lock-wait-timeout=5s', '--snapshot', snapshot,
    ], { detached: true, env: {
      ...SAFE_ENV, PGSSLMODE: 'verify-full', PGSSLROOTCERT: CA_PATH, PGCONNECT_TIMEOUT: '12',
      PGAPPNAME: 'sinegasi-encrypted-pg-dump-readonly', PGPASSFILE: '/dev/null',
      PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=120000',
    }, stdio: ['pipe', 'pipe', 'pipe'] });
    let diagnostics = '';
    dump.stderr.on('data', (chunk: Buffer) => { if (diagnostics.length < 16384) diagnostics += chunk.toString('utf8'); });
    const done = new Promise<void>((resolve, reject) => {
      dump.on('error', () => reject(new BackupError('PG_DUMP_FAILED')));
      dump.on('close', (code) => {
        // Only the forced prompt may appear. Treat other warnings as failure.
        if (code !== 0 || diagnostics.replace(/Password:\s*/g, '').trim()) reject(new BackupError('PG_DUMP_FAILED_OR_WARNED'));
        else resolve();
      });
    });
    dump.stdin.on('error', () => {});
    dump.stdin.end(target.password + '\n');
    target.password = '';
    const timer = setTimeout(() => dump.kill('SIGKILL'), 180000);
    let archive: { sha256: string; bytes: number };
    try {
      [archive] = await Promise.all([
        encryptStream(dump.stdout, key.recipient, directory + '/database.dump.age'), done,
      ]);
    } finally {
      clearTimeout(timer); dump.kill('SIGKILL'); diagnostics = '';
    }
    const metadata = await encryptStream(Readable.from([JSON.stringify({
      format: 1, project: BACKUP_PROJECT, id, sourceVersion: info.version, inventory,
      scope: 'all pg_dump non-system database schemas/data/ACLs; no cluster role passwords, provider config or storage object bytes',
    })]), key.recipient, directory + '/metadata.json.age');
    key.identity = '';
    await client.query('ROLLBACK');
    const receipt = {
      status: 'BACKUP_CREATED_RESTORE_NOT_YET_VERIFIED', project: BACKUP_PROJECT, id,
      encrypted: true, archive, metadata, recipient: key.recipient,
      encryptionKeyService: 'sinegasi-prod-backup-age-identity', sourceVersion: info.version,
      productionChanged: false, publicTables: inventory.tables.length,
      restoreVerified: false, offDeviceRecoveryCopyVerified: false,
    };
    const handle = await open(directory + '/receipt.json', constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(JSON.stringify(receipt, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    console.log(JSON.stringify({ ...receipt, directory }));
  } finally {
    target.password = '';
    await client.end().catch(() => {});
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof BackupError ? error.stage : 'BACKUP_OPERATION_FAILED', productionChanged: false }));
  process.exitCode = 1;
});
