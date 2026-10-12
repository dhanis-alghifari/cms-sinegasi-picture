import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  bootstrapFirstTeacher, BootstrapTeacherError, validateBootstrapTeacherOptions,
  type BootstrapDatabase, type BootstrapTeacherCredential, type BootstrapTeacherOptions,
} from './bootstrapTeacherCore.js';
import { privateBootstrapCredentialStore } from './bootstrapTeacherCredentials.js';
import { verifyPassword } from '../services/passwordService.js';
import { parseBootstrapTeacherCommand } from './bootstrapTeacher.js';

const PROJECT_REF = 'pvbdiftvzoeelibxlxzb';
const applyOptions: BootstrapTeacherOptions = {
  projectRef: PROJECT_REF, username: 'bootstrap.test', nama: 'Guru Test Fixture',
  apply: true, confirmProject: PROJECT_REF,
};

class FakeBootstrapDatabase implements BootstrapDatabase {
  readonly queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
  nonempty = false;
  schemaReady = true;
  permissionsReady = true;
  auditReady = true;
  failOn?: string;

  async query(sql: string, values?: readonly unknown[]) {
    this.queries.push({ sql, values });
    if (this.failOn && sql.includes(this.failOn)) throw new Error('A database error may contain confidential input');
    if (sql.includes('AS nonempty')) return { rows: [{ nonempty: this.nonempty }] };
    if (sql.includes('information_schema.columns')) return { rows: [{ ready: this.schemaReady }] };
    if (sql.includes('public.access_role_permissions')) return { rows: [{ ready: this.permissionsReady }] };
    if (sql.includes('FROM public.activity_logs')) return { rows: [{ ready: this.auditReady }] };
    return { rows: [] };
  }
}

function fixture() {
  const database = new FakeBootstrapDatabase();
  const credentials: BootstrapTeacherCredential[] = [];
  let removed = false;
  return {
    database, credentials,
    get removed() { return removed; },
    dependencies: {
      database,
      credentials: { async create(credential: BootstrapTeacherCredential) {
        credentials.push(credential);
        return { async remove() { removed = true; } };
      } },
    },
  };
}

test('bootstrap defaults to an offline plan without database calls, secrets or file creation', async () => {
  const context = fixture();
  const result = await bootstrapFirstTeacher({ ...applyOptions, apply: false, confirmProject: undefined }, context.dependencies);
  assert.deepEqual(result, { mode: 'dry-run', role: 'teacher', isFirstLogin: true, databaseChecked: false });
  assert.equal(context.database.queries.length, 0);
  assert.equal(context.credentials.length, 0);
});

test('bootstrap requires valid official identity and exact project approval before any query', async () => {
  const invalid = [
    { ...applyOptions, projectRef: 'invalid' }, { ...applyOptions, confirmProject: undefined },
    { ...applyOptions, confirmProject: 'aaaaaaaaaaaaaaaaaaaa' }, { ...applyOptions, username: "admin'; --" },
    { ...applyOptions, nama: 'A' }, { ...applyOptions, nama: ' Guru Fixture ' },
    { ...applyOptions, nama: 'Guru\nFixture' },
  ];
  for (const options of invalid) {
    const context = fixture();
    await assert.rejects(bootstrapFirstTeacher(options, context.dependencies), BootstrapTeacherError);
    assert.equal(context.database.queries.length, 0);
  }
  assert.doesNotThrow(() => validateBootstrapTeacherOptions({ ...applyOptions, nama: "Guru O'Neil" }));
});

test('bootstrap refuses existing users and rolls back without generating credentials', async () => {
  const context = fixture();
  context.database.nonempty = true;
  await assert.rejects(bootstrapFirstTeacher(applyOptions, context.dependencies), { code: 'BOOTSTRAP_USERS_NOT_EMPTY' });
  assert.equal(context.credentials.length, 0);
  assert.equal(context.database.queries.at(-1)?.sql, 'ROLLBACK');
  assert(!context.database.queries.some((query) => query.sql.includes('INSERT INTO')));
});

test('bootstrap fails closed when auth-version, redacted audit or teacher capabilities are absent', async () => {
  for (const missing of ['schemaReady', 'permissionsReady'] as const) {
    const context = fixture();
    context.database[missing] = false;
    await assert.rejects(bootstrapFirstTeacher(applyOptions, context.dependencies), BootstrapTeacherError);
    assert.equal(context.credentials.length, 0);
    assert.equal(context.database.queries.at(-1)?.sql, 'ROLLBACK');
  }
});

test('bootstrap creates exactly one teacher with scrypt, forced change and one sanitized audit atomically', async () => {
  const context = fixture();
  const result = await bootstrapFirstTeacher(applyOptions, context.dependencies);
  const credential = context.credentials[0];
  assert.equal(result.mode, 'applied');
  assert.equal(context.credentials.length, 1);
  assert.match(credential.temporaryPassword, /^Guru-[A-Za-z0-9_-]{32}-1$/);
  assert.equal(credential.role, 'teacher');
  assert.equal(credential.isFirstLogin, true);
  assert.equal(context.removed, false);
  const insert = context.database.queries.find((query) => query.sql.includes('INSERT INTO public.users'));
  assert(insert);
  const hash = insert.values?.[2];
  assert.equal(typeof hash, 'string');
  assert.match(hash as string, /^scrypt\$/);
  assert.deepEqual(await verifyPassword(credential.temporaryPassword, hash), { valid: true, needsRehash: false });
  assert(insert.sql.includes("'teacher', true, true, 1"));
  const audits = context.database.queries.filter((query) => query.sql.includes('SELECT public.write_audit_log'));
  assert.equal(audits.length, 1);
  assert.equal(audits[0].values?.[0], credential.userId);
  const snapshot = String(audits[0].values?.[1]);
  assert(!snapshot.includes('password'));
  assert(!snapshot.includes(hash as string));
  assert(!JSON.stringify(result).includes(credential.temporaryPassword));
  assert(!JSON.stringify(context.database.queries).includes(credential.temporaryPassword));
  assert.equal(context.database.queries[0].sql, 'BEGIN');
  assert(context.database.queries[2].sql.includes('LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE'));
  assert(context.database.queries[3].sql.includes('AS nonempty'));
  assert.equal(context.database.queries.at(-1)?.sql, 'COMMIT');
});

test('bootstrap persists no account when credential storage fails', async () => {
  const context = fixture();
  await assert.rejects(bootstrapFirstTeacher(applyOptions, {
    database: context.database,
    credentials: { async create() { throw new Error('Write failed with confidential context'); } },
  }), { code: 'BOOTSTRAP_FAILED' });
  assert.equal(context.database.queries.at(-1)?.sql, 'ROLLBACK');
  assert(!context.database.queries.some((query) => query.sql.includes('INSERT INTO')));
});

test('bootstrap rolls back account and cleans only its new credential file on pre-commit failure', async () => {
  const context = fixture();
  context.database.failOn = 'SELECT public.write_audit_log';
  await assert.rejects(bootstrapFirstTeacher(applyOptions, context.dependencies), { code: 'BOOTSTRAP_FAILED' });
  assert.equal(context.removed, true);
  assert.equal(context.database.queries.at(-1)?.sql, 'ROLLBACK');
  assert(!context.database.queries.some((query) => query.sql === 'COMMIT'));
});

test('duplicate legacy audit rows or altered snapshots refuse COMMIT and clean credentials', async () => {
  const context = fixture();
  context.database.auditReady = false;
  await assert.rejects(bootstrapFirstTeacher(applyOptions, context.dependencies), { code: 'BOOTSTRAP_AUDIT_NOT_CANONICAL' });
  assert.equal(context.removed, true);
  assert.equal(context.database.queries.at(-1)?.sql, 'ROLLBACK');
  assert(!context.database.queries.some((query) => query.sql === 'COMMIT'));
});

test('ambiguous COMMIT keeps the sole credential copy and never retries creation', async () => {
  const context = fixture();
  context.database.failOn = 'COMMIT';
  await assert.rejects(bootstrapFirstTeacher(applyOptions, context.dependencies), {
    code: 'BOOTSTRAP_COMMIT_UNCERTAIN_CREDENTIAL_FILE_PRESERVED',
  });
  assert.equal(context.removed, false);
  assert.equal(context.database.queries.filter((query) => query.sql.includes('INSERT INTO public.users')).length, 1);
});

test('authorization runs under the account lock before credentials and refuses atomically', async () => {
  const context = fixture();
  await assert.rejects(bootstrapFirstTeacher(applyOptions, { ...context.dependencies, async beforeCreate() {
    assert(context.database.queries.at(-1)?.sql.includes('LOCK TABLE public.users'));
    throw new BootstrapTeacherError('BOOTSTRAP_REVIEW_REFUSED');
  } }), { code: 'BOOTSTRAP_REVIEW_REFUSED' });
  assert.equal(context.credentials.length, 0);
  assert.equal(context.database.queries.at(-1)?.sql, 'ROLLBACK');
});

test('final authorization can refuse COMMIT and remove only uncommitted credentials', async () => {
  const context = fixture();
  await assert.rejects(bootstrapFirstTeacher(applyOptions, { ...context.dependencies, async beforeCommit() {
    throw new BootstrapTeacherError('BOOTSTRAP_APPROVED_WINDOW_REQUIRED');
  } }), { code: 'BOOTSTRAP_APPROVED_WINDOW_REQUIRED' });
  assert.equal(context.removed, true);
  assert(!context.database.queries.some(q => q.sql === 'COMMIT'));
});

test('lost ROLLBACK acknowledgement keeps credentials and reports uncertainty', async () => {
  const context = fixture();
  context.database.failOn = 'ROLLBACK';
  await assert.rejects(bootstrapFirstTeacher(applyOptions, { ...context.dependencies, async beforeCommit() {
    throw new Error('synthetic confidential failure');
  } }), { code: 'BOOTSTRAP_ROLLBACK_UNCERTAIN_INSPECT_BEFORE_RETRY' });
  assert.equal(context.removed, false);
  assert(!context.database.queries.some(q => q.sql === 'COMMIT'));
});

test('CLI never accepts passwords/database URLs as arguments or echoes invalid argument values', () => {
  const command = parseBootstrapTeacherCommand(['--project-ref', PROJECT_REF, '--username', 'bootstrap.test', '--name', 'Guru Fixture']);
  assert.equal(command.options.apply, false);
  for (const args of [
    ['--password', 'Confidential123'], ['--database-url', 'postgres://secret'],
    ['--apply', '--dry-run'],
  ]) {
    try { parseBootstrapTeacherCommand(args); assert.fail('Expected refusal'); }
    catch (error: unknown) {
      assert(error instanceof BootstrapTeacherError);
      assert(!error.message.includes('Confidential123'));
      assert(!error.message.includes('postgres://'));
    }
  }
  assert.throws(() => parseBootstrapTeacherCommand([
    '--project-ref', PROJECT_REF, '--username', 'bootstrap.test', '--name', 'Guru Fixture',
    '--apply', '--confirm-project', PROJECT_REF,
  ]), { code: 'BOOTSTRAP_CREDENTIAL_PATH_INVALID' });
});

async function withPrivateDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const root = await realpath(os.tmpdir());
  const directory = await mkdtemp(path.join(root, 'sinegasi-bootstrap-test-'));
  await chmod(directory, 0o700);
  try { await run(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

const fileFixture: BootstrapTeacherCredential = {
  version: 1, projectRef: PROJECT_REF, userId: '00000000-0000-4000-8000-000000000001',
  username: 'bootstrap.test', nama: 'Guru Fixture', role: 'teacher',
  temporaryPassword: 'TestFixtureOnly123', isFirstLogin: true,
};

test('credential file is exclusive 0600, in a private directory, and removable on rollback', async () => {
  await withPrivateDirectory(async (directory) => {
    const filePath = path.join(directory, 'credential.json');
    const created = await privateBootstrapCredentialStore(filePath).create(fileFixture);
    assert.equal((await lstat(filePath)).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), fileFixture);
    await assert.rejects(privateBootstrapCredentialStore(filePath).create(fileFixture));
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), fileFixture);
    await created.remove();
    await assert.rejects(lstat(filePath), { code: 'ENOENT' });
  });
});

test('credential file refuses symlinks without overwriting their destination', async () => {
  await withPrivateDirectory(async (directory) => {
    const target = path.join(directory, 'target.json');
    const linked = path.join(directory, 'credential.json');
    await writeFile(target, 'existing');
    await symlink(target, linked);
    await assert.rejects(privateBootstrapCredentialStore(linked).create(fileFixture));
    assert.equal(await readFile(target, 'utf8'), 'existing');
    assert((await lstat(linked)).isSymbolicLink());
  });
});

test('credential file refuses shared directories, relative paths and repository storage', async () => {
  await withPrivateDirectory(async (directory) => {
    await chmod(directory, 0o755);
    await assert.rejects(privateBootstrapCredentialStore(path.join(directory, 'credential.json')).create(fileFixture), {
      code: 'BOOTSTRAP_CREDENTIAL_DIRECTORY_NOT_PRIVATE',
    });
    await chmod(directory, 0o700);
    await assert.rejects(privateBootstrapCredentialStore('credential.json').create(fileFixture), {
      code: 'BOOTSTRAP_CREDENTIAL_PATH_INVALID',
    });
    await mkdir(path.join(directory, '.git'));
    await assert.rejects(privateBootstrapCredentialStore(path.join(directory, 'credential.json')).create(fileFixture), {
      code: 'BOOTSTRAP_CREDENTIAL_FILE_IN_REPOSITORY',
    });
  });
});

test('credential cleanup refuses a replaced symlink instead of deleting another file', async () => {
  await withPrivateDirectory(async (directory) => {
    const filePath = path.join(directory, 'credential.json');
    const created = await privateBootstrapCredentialStore(filePath).create(fileFixture);
    await rm(filePath);
    const target = path.join(directory, 'target.json');
    await writeFile(target, 'replacement');
    await symlink(target, filePath);
    await assert.rejects(created.remove(), { code: 'BOOTSTRAP_CREDENTIAL_FILE_CHANGED' });
    assert.equal(await readFile(target, 'utf8'), 'replacement');
  });
});
