import { X509Certificate, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants, createWriteStream } from 'node:fs';
import { lstat, mkdir, open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import type { Client } from 'pg';

export const BACKUP_PROJECT = 'pvbdiftvzoeelibxlxzb';
export const BACKUP_HOST = 'aws-0-ap-southeast-1.pooler.supabase.com';
export const BACKUP_ROOT = '/Users/memberid/Library/Application Support/Sinegasi/Backups';
export const LOGIN_KEYCHAIN = '/Users/memberid/Library/Keychains/login.keychain-db';
export const BACKUP_KEY_SERVICE = 'sinegasi-prod-backup-age-identity';
export const AGE = '/opt/homebrew/bin/age';
export const AGE_KEYGEN = '/opt/homebrew/bin/age-keygen';
export const PG_DUMP = '/opt/homebrew/opt/libpq@17/bin/pg_dump';
export const SAFE_ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
export const GITHUB_REPOSITORY_URL = 'https://github.com/dhanis-alghifari/cms-sinegasi-picture.git';
const GITHUB_QUALITY_ENV = {
  ...SAFE_ENV, HOME: '/Users/memberid', GH_CONFIG_DIR: '/Users/memberid/.config/gh',
  XDG_STATE_HOME: '/Users/memberid/.local/state', GH_HOST: 'github.com',
  GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_TELEMETRY: '0',
};
const MAX_OUTPUT = 256 * 1024 * 1024;

export class BackupError extends Error {
  constructor(public readonly stage: string) {
    super(stage);
  }
}

export function validateBackupTarget(raw: string): { password: string; user: string } {
  try {
    const url = new URL(raw.trim());
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || url.hostname !== BACKUP_HOST || url.port !== '5432'
      || url.pathname !== '/postgres' || url.hash
      || user !== `postgres.${BACKUP_PROJECT}`
      || !password || /[\r\n\0]/.test(password) || password.includes('YOUR-PASSWORD')
      || [...url.searchParams].some(([key, value]) => key !== 'sslmode' || !['require', 'verify-full'].includes(value))
      || url.searchParams.getAll('sslmode').length > 1) throw new Error();
    return { user, password };
  } catch {
    throw new BackupError('INVALID_PRODUCTION_TARGET');
  }
}

export function validateBackupCa(pem: string, now = Date.now()): void {
  try {
    if (pem.includes('PRIVATE KEY')) throw new Error();
    const cert = new X509Certificate(pem);
    if (!cert.ca || !cert.verify(cert.publicKey)
      || now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)
      || cert.fingerprint256 !== '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA') throw new Error();
  } catch {
    throw new BackupError('INVALID_SUPABASE_CA');
  }
}

export function quoteIdentifier(value: string): string {
  if (value.includes('\0')) throw new BackupError('INVALID_IDENTIFIER');
  return `"${value.replaceAll('"', '""')}"`;
}

export async function privateDirectory(path: string): Promise<void> {
  if (path !== BACKUP_ROOT && !new RegExp(`^${BACKUP_ROOT}/[0-9TZ-]+$`).test(path)) {
    throw new BackupError('UNSAFE_BACKUP_PATH');
  }
  const parent = '/Users/memberid/Library/Application Support';
  const parentStat = await lstat(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || parentStat.uid !== process.getuid?.()) {
    throw new BackupError('UNSAFE_BACKUP_PARENT');
  }
  for (const part of [parent + '/Sinegasi', BACKUP_ROOT, ...(path === BACKUP_ROOT ? [] : [path])]) {
    await mkdir(part, { mode: 0o700 }).catch((error: unknown) => {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw new BackupError('BACKUP_DIRECTORY_FAILED');
    });
    const info = await lstat(part);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.()
      || (info.mode & 0o777) !== 0o700) throw new BackupError('BACKUP_DIRECTORY_NOT_PRIVATE');
  }
}

// No shell, inherited application environment, TTY, secret arguments or raw diagnostics.
export async function privateCommandBytes(command: string, args: string[], input: string | Buffer = '', timeout = 30_000, maxBytes = 1024 * 1024): Promise<Buffer> {
  return runPrivateCommandBytes(command, args, input, timeout, maxBytes, SAFE_ENV);
}

async function runPrivateCommandBytes(command: string, args: string[], input: string | Buffer,
  timeout: number, maxBytes: number, environment: NodeJS.ProcessEnv): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // A fast child may close stdin before even an empty write on Linux.
    // Only create a pipe when there is data to deliver; real input errors still fail closed.
    const options = { detached: true, env: environment };
    const child = input.length > 0
      ? spawn(command, args, { ...options, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); fail(); }, timeout);
    const fail = () => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new BackupError('PRIVATE_COMMAND_FAILED')); }
    };
    child.on('error', fail);
    child.stdin?.on('error', fail);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) { child.kill('SIGKILL'); fail(); }
      else chunks.push(chunk);
    });
    // Drain, but never retain or display diagnostic output that could contain secrets.
    child.stderr.resume();
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) { fail(); return; }
      if (!settled) { settled = true; resolve(Buffer.concat(chunks)); }
    });
    child.stdin?.end(input);
  });
}

export async function privateCommand(command: string, args: string[], input = '', timeout = 30_000): Promise<string> {
  return (await privateCommandBytes(command, args, input, timeout)).toString('utf8');
}

// Only this fixed, read-only CI lookup can access the operator's existing gh
// login. Generic backup/Keychain commands cannot inherit HOME or gh overrides.
export async function readGithubQualityMetadata(runId: number): Promise<{ run: unknown; jobs: unknown }> {
  if (!Number.isSafeInteger(runId) || runId <= 0) throw new BackupError('INVALID_GITHUB_QUALITY_RUN_ID');
  const endpoint = `repos/dhanis-alghifari/cms-sinegasi-picture/actions/runs/${runId}`;
  const read = async (path: string): Promise<unknown> => JSON.parse((await runPrivateCommandBytes(
    '/opt/homebrew/bin/gh', ['api', '--hostname', 'github.com', '--method', 'GET', path],
    '', 30_000, 1024 * 1024, GITHUB_QUALITY_ENV,
  )).toString('utf8')) as unknown;
  try {
    const run = await read(endpoint);
    const jobs = await read(endpoint + '/jobs?per_page=100');
    return { run, jobs };
  } catch {
    throw new BackupError('GITHUB_QUALITY_METADATA_UNAVAILABLE');
  }
}

// Fixed read-only target, not a generic authenticated Git command. Ignore Git
// config outside this invocation and use the existing gh login without tokens
// in arguments, inherited overrides, credential persistence or interactive Git.
export async function readGithubMainSha(): Promise<string> {
  try {
    const output = (await runPrivateCommandBytes('/usr/bin/git', [
      '-C', '/', '-c', 'credential.helper=',
      '-c', 'credential.helper=/opt/homebrew/bin/gh auth git-credential', '-c', 'core.askPass=',
      '-c', 'http.sslVerify=true', '-c', 'http.followRedirects=false',
      'ls-remote', '--exit-code', '--refs', GITHUB_REPOSITORY_URL, 'refs/heads/main',
    ], '', 30_000, 1024, {
      ...GITHUB_QUALITY_ENV, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0',
    })).toString('utf8');
    const match = /^([a-f0-9]{40})\trefs\/heads\/main\n?$/.exec(output);
    if (!match) throw new Error();
    return match[1];
  } catch {
    throw new BackupError('GITHUB_MAIN_METADATA_UNAVAILABLE');
  }
}

/** Fixed production protection lookup; never export unrelated variables or secrets. */
export async function readGithubProductionProtection(): Promise<{
  environment: unknown; branches: unknown; migrationReady: boolean; reviewMode: unknown;
}> {
  const root = 'repos/dhanis-alghifari/cms-sinegasi-picture/environments/production';
  const read = async (suffix: string): Promise<unknown> => JSON.parse((await runPrivateCommandBytes(
    '/opt/homebrew/bin/gh', ['api', '--hostname', 'github.com', '--method', 'GET', root + suffix],
    '', 30_000, 1024 * 1024, GITHUB_QUALITY_ENV,
  )).toString('utf8')) as unknown;
  const [environment, branches, value] = await Promise.all([read(''), read('/deployment-branch-policies?per_page=100'), read('/variables?per_page=100')]);
  const variables = value as { total_count?: unknown; variables?: Array<{ name?: unknown; value?: unknown }> };
  if (!Array.isArray(variables.variables) || variables.total_count !== variables.variables.length) {
    throw new BackupError('PRODUCTION_PROTECTION_METADATA_INCOMPLETE');
  }
  return { environment, branches,
    migrationReady: variables.variables.find(v => v.name === 'PRODUCTION_STUDENT_PHOTO_MIGRATION_READY')?.value === 'true',
    reviewMode: variables.variables.find(v => v.name === 'PRODUCTION_REVIEW_MODE')?.value };
}

export async function readKeychain(service: string, account: string): Promise<string> {
  return privateCommand('/usr/bin/security', [
    'find-generic-password', '-s', service, '-a', account, '-w', LOGIN_KEYCHAIN,
  ], '', 180_000);
}

export async function backupIdentity(): Promise<{ identity: string; recipient: string; created: boolean }> {
  const exists = await privateCommand('/usr/bin/security', [
    'find-generic-password', '-s', BACKUP_KEY_SERVICE, '-a', BACKUP_PROJECT, LOGIN_KEYCHAIN,
  ]).then(() => true, () => false);
  let identity: string;
  if (exists) {
    identity = (await readKeychain(BACKUP_KEY_SERVICE, BACKUP_PROJECT)).trim();
  } else {
    const generated = await privateCommand(AGE_KEYGEN, []);
    identity = generated.split('\n').find((line) => /^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(line)) ?? '';
    if (!identity) throw new BackupError('AGE_KEY_GENERATION_FAILED');
    // Interactive CLI parses stdin: the private key is never in process arguments.
    // Empty trust list means an access dialog is required, NOT "Allow any app".
    await privateCommand('/usr/bin/security', ['-i', '-q'],
      `add-generic-password -s ${BACKUP_KEY_SERVICE} -a ${BACKUP_PROJECT} -T "" -w ${identity} ${LOGIN_KEYCHAIN}\n`);
    const stored = (await readKeychain(BACKUP_KEY_SERVICE, BACKUP_PROJECT)).trim();
    if (stored !== identity) throw new BackupError('KEYCHAIN_KEY_NOT_VERIFIED');
  }
  if (!/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(identity)) throw new BackupError('INVALID_BACKUP_IDENTITY');
  const recipient = (await privateCommand(AGE_KEYGEN, ['-y'], identity + '\n')).trim();
  if (!/^age1[0-9a-z]+$/.test(recipient)) throw new BackupError('INVALID_BACKUP_RECIPIENT');
  return { identity, recipient, created: !exists };
}

export interface DatabaseInventory {
  tables: { schema: string; name: string; rows: string; rls: boolean; forceRls: boolean }[];
  structure: Record<string, unknown>[];
  extensions: { name: string; schema: string; version: string }[];
  roles: { name: string; inherit: boolean; bypassRls: boolean }[];
}

export async function databaseInventory(client: Client): Promise<DatabaseInventory> {
  const tables = (await client.query<{ schema: string; name: string; rls: boolean; forceRls: boolean }>(`
    SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS "forceRls"
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY n.nspname,c.relname
  `)).rows;
  const counts: DatabaseInventory['tables'] = [];
  for (const table of tables) {
    const result = await client.query<{ rows: string }>(
      `SELECT count(*)::text AS rows FROM ${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`);
    counts.push({ ...table, rows: result.rows[0].rows });
  }
  const structure = (await client.query(`
    SELECT kind,name,definition FROM (
      SELECT 'column' AS kind,c.relname||'.'||a.attname AS name,
        jsonb_build_object('position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
          'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))::text AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v') AND a.attnum>0 AND NOT a.attisdropped
      UNION ALL
      SELECT 'constraint',c.relname||'.'||co.conname,pg_get_constraintdef(co.oid)
      FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      UNION ALL
      SELECT 'index',c.relname,pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'
      UNION ALL
      SELECT 'function',p.oid::regprocedure::text,pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
      UNION ALL
      SELECT 'trigger',c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
      UNION ALL
      SELECT 'enum',t.typname,jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)::text
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' GROUP BY t.typname
      UNION ALL
      SELECT 'view',c.relname,pg_get_viewdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'
      UNION ALL
      SELECT 'policy',tablename||'.'||policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)::text
      FROM pg_policies WHERE schemaname='public'
    ) AS objects ORDER BY kind COLLATE "C",name COLLATE "C"
  `)).rows as Record<string, unknown>[];
  const extensions = (await client.query<DatabaseInventory['extensions'][number]>(`
    SELECT e.extname AS name,n.nspname AS schema,e.extversion AS version
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname
  `)).rows;
  const roles = (await client.query<DatabaseInventory['roles'][number]>(`
    SELECT rolname AS name,rolinherit AS inherit,rolbypassrls AS "bypassRls" FROM pg_roles
    WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname
  `)).rows;
  return { tables: counts, structure, extensions, roles };
}

export async function encryptStream(input: Readable, recipient: string, output: string): Promise<{ sha256: string; bytes: number }> {
  const handle = await open(output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  const child = spawn(AGE, ['--encrypt', '-r', recipient], { detached: true, env: SAFE_ENV, stdio: ['pipe', 'pipe', 'pipe'] });
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', () => reject(new BackupError('ENCRYPTION_FAILED')));
    child.on('close', (code) => code === 0 ? resolve() : reject(new BackupError('ENCRYPTION_FAILED')));
  });
  child.stderr.resume();
  const hash = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > MAX_OUTPUT) { callback(new BackupError('BACKUP_SIZE_LIMIT')); return; }
    hash.update(chunk); callback(null, chunk);
  } });
  const writer = createWriteStream(output, { fd: handle.fd, autoClose: false });
  const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
  try {
    await Promise.all([pipeline(input, child.stdin), pipeline(child.stdout, meter, writer), done]);
    await handle.sync();
    if (bytes < 100) throw new BackupError('EMPTY_ENCRYPTED_BACKUP');
    return { sha256: hash.digest('hex'), bytes };
  } catch {
    child.kill('SIGKILL');
    throw new BackupError('ENCRYPTED_BACKUP_FAILED');
  } finally {
    clearTimeout(timer);
    await handle.close();
  }
}
