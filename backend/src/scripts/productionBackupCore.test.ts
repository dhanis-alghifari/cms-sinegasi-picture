import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_HOST, BACKUP_PROJECT, BackupError, privateCommandBytes, privateDirectory, quoteIdentifier, validateBackupCa, validateBackupTarget } from './productionBackupCore.js';

const uri = `postgresql://postgres.${BACKUP_PROJECT}:test-secret@${BACKUP_HOST}:5432/postgres`;

test('accept only exact production session pooler with valid password', () => {
  assert.deepEqual(validateBackupTarget(uri), { user: `postgres.${BACKUP_PROJECT}`, password: 'test-secret' });
  assert.equal(validateBackupTarget(uri.replace('test-secret', 'a%40b%3Ac%2Fd%25')).password, 'a@b:c/d%');
  assert.doesNotThrow(() => validateBackupTarget(uri + '?sslmode=verify-full'));
});

for (const [name, value] of Object.entries({
  host: uri.replace(BACKUP_HOST, 'evil.invalid'),
  project: uri.replace(BACKUP_PROJECT, 'dev-project'),
  transactionPool: uri.replace(':5432/', ':6543/'),
  missingPort: uri.replace(':5432/', '/'),
  database: uri.replace('/postgres', '/other'),
  insecureSsl: uri + '?sslmode=disable',
  queryPassword: uri + '?password=another-secret',
  duplicatedSsl: uri + '?sslmode=require&sslmode=verify-full',
  fragment: uri + '#invalid',
  newlinePassword: uri.replace('test-secret', 'secret%0Amore'),
  placeholder: uri.replace('test-secret', 'YOUR-PASSWORD'),
  malformed: 'not a URI test-secret',
})) test(`reject ${name} without leaking secret`, () => {
  assert.throws(() => validateBackupTarget(value), (error: unknown) =>
    error instanceof BackupError && error.message === 'INVALID_PRODUCTION_TARGET' && !error.message.includes('test-secret'));
});

test('quote catalog names instead of interpolating executable identifiers', () => {
  assert.equal(quoteIdentifier('user"; DROP DATABASE postgres;--'), '"user""; DROP DATABASE postgres;--"');
  assert.throws(() => quoteIdentifier('bad\0name'), BackupError);
});

test('invalid and private-key CA input fails closed with sanitized error', () => {
  assert.throws(() => validateBackupCa('secret private text'), /INVALID_SUPABASE_CA/);
  assert.throws(() => validateBackupCa('-----BEGIN PRIVATE KEY-----'), /INVALID_SUPABASE_CA/);
});

test('child diagnostics are not propagated or application environment inherited', async () => {
  const old = process.env.SINEGASI_SYNTHETIC_SECRET;
  process.env.SINEGASI_SYNTHETIC_SECRET = 'test-secret-not-real';
  try {
    const output = await privateCommandBytes(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.env))']);
    const childEnvironment = JSON.parse(output.toString('utf8')) as Record<string, string>;
    // CoreFoundation adds this non-secret encoding value on macOS even when
    // spawn receives an explicit minimal environment. It is not inheritance.
    if (process.platform === 'darwin' && childEnvironment.__CF_USER_TEXT_ENCODING) {
      assert.match(childEnvironment.__CF_USER_TEXT_ENCODING, /^0x[0-9A-Fa-f]+:0x[0-9A-Fa-f]+:0x[0-9A-Fa-f]+$/);
      delete childEnvironment.__CF_USER_TEXT_ENCODING;
    }
    assert.deepEqual(childEnvironment, { PATH: '/usr/bin:/bin', LANG: 'C' });
    await assert.rejects(privateCommandBytes(process.execPath, ['-e', 'process.stderr.write("test-secret-not-real"); process.exit(1)']),
      (error: unknown) => error instanceof BackupError && error.message === 'PRIVATE_COMMAND_FAILED');
  } finally {
    if (old === undefined) delete process.env.SINEGASI_SYNTHETIC_SECRET;
    else process.env.SINEGASI_SYNTHETIC_SECRET = old;
  }
});

test('command timeout and output cap fail closed', async () => {
  await assert.rejects(privateCommandBytes(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], '', 30), BackupError);
  await assert.rejects(privateCommandBytes(process.execPath, ['-e', 'process.stdout.write("x".repeat(10000))'], '', 3000, 100), BackupError);
});

test('refuse repository, traversal and arbitrary backup directories before access', async () => {
  for (const path of ['/tmp/backup', process.cwd(), '/Users/memberid/Library/Application Support/Sinegasi/Backups/../Recovery']) {
    await assert.rejects(privateDirectory(path), /UNSAFE_BACKUP_PATH/);
  }
});
