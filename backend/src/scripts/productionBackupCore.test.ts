import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess, { type SpawnOptions } from 'node:child_process';
import { BACKUP_HOST, BACKUP_PROJECT, BackupError, privateCommandBytes, privateDirectory, quoteIdentifier, readGithubMainSha, readGithubQualityMetadata, validateBackupCa, validateBackupTarget } from './productionBackupCore.js';

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

test('empty input has no stdin pipe, including fast-exiting children and empty buffers', async (t) => {
  const spawn = childProcess.spawn;
  const stub = t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: SpawnOptions) => {
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    const child = spawn(command, args, options);
    assert.equal(child.stdin, null);
    return child;
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    for (const input of ['', Buffer.alloc(0)]) {
      assert.equal((await privateCommandBytes('/bin/bash', ['-c', 'printf %s immediate'], input)).toString('utf8'), 'immediate');
    }
  }
  assert.equal(stub.mock.callCount(), 20);
});

test('nonempty private input retains a pipe and round-trips bytes without arguments or environment', async (t) => {
  const input = Buffer.from([0, 255, 10, 39, 36, 96, 13]);
  const spawn = childProcess.spawn;
  t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: SpawnOptions) => {
    assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.deepEqual(options.env, { PATH: '/usr/bin:/bin', LANG: 'C' });
    return spawn(command, args, options);
  });
  assert.deepEqual(await privateCommandBytes(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], input), input);
});

test('a broken stdin pipe with nonempty input remains a sanitized failure', async () => {
  await assert.rejects(privateCommandBytes(process.execPath, ['-e',
    'require("node:fs").closeSync(0);setTimeout(() => {}, 100)'], Buffer.alloc(8 * 1024 * 1024, 120)),
  (error: unknown) => error instanceof BackupError && error.message === 'PRIVATE_COMMAND_FAILED');
});

test('refuse repository, traversal and arbitrary backup directories before access', async () => {
  for (const path of ['/tmp/backup', process.cwd(), '/Users/memberid/Library/Application Support/Sinegasi/Backups/../Recovery']) {
    await assert.rejects(privateDirectory(path), /UNSAFE_BACKUP_PATH/);
  }
});

test('GitHub quality lookup uses only fixed GET endpoints and trusted Mac config, without inherited overrides', async (t) => {
  const keys = ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_DEBUG', 'HOME', 'GH_CONFIG_DIR', 'XDG_CONFIG_HOME',
    'XDG_STATE_HOME', 'GH_HOST', 'HTTPS_PROXY', 'NODE_OPTIONS', 'SINEGASI_SYNTHETIC_SECRET'] as const;
  const previous = keys.map(key => [key, process.env[key]] as const);
  for (const key of keys) process.env[key] = 'synthetic-untrusted-override';
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const calls: { command: string; args: string[]; options: SpawnOptions }[] = [];
  const spawn = childProcess.spawn;
  const stub = t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: SpawnOptions) => {
    calls.push({ command, args, options });
    return spawn(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({env:process.env}))'], options);
  });
  const metadata = await readGithubQualityMetadata(38129894832);
  assert.equal(calls.length, 2);
  for (const [index, call] of calls.entries()) {
    assert.equal(call.command, '/opt/homebrew/bin/gh');
    assert.deepEqual(call.args, ['api', '--hostname', 'github.com', '--method', 'GET',
      'repos/dhanis-alghifari/cms-sinegasi-picture/actions/runs/38129894832' + (index === 1 ? '/jobs?per_page=100' : '')]);
    assert.equal(call.options.detached, true);
    assert.deepEqual(call.options.stdio, ['ignore', 'pipe', 'pipe']);
  }
  for (const result of [metadata.run, metadata.jobs]) {
    const environment = (result as { env: Record<string, string> }).env;
    delete environment.__CF_USER_TEXT_ENCODING;
    assert.deepEqual(environment, {
      PATH: '/usr/bin:/bin', LANG: 'C', HOME: '/Users/memberid',
      GH_CONFIG_DIR: '/Users/memberid/.config/gh', XDG_STATE_HOME: '/Users/memberid/.local/state',
      GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_TELEMETRY: '0',
    });
  }
  stub.mock.restore();
  const generic = JSON.parse((await privateCommandBytes(process.execPath,
    ['-e', 'process.stdout.write(JSON.stringify(process.env))'])).toString('utf8')) as Record<string, string>;
  delete generic.__CF_USER_TEXT_ENCODING;
  assert.deepEqual(generic, { PATH: '/usr/bin:/bin', LANG: 'C' });
});

test('invalid GitHub run IDs are rejected before spawning a process', async (t) => {
  const spawn = t.mock.method(childProcess, 'spawn', () => { throw new Error('must not spawn'); });
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(readGithubQualityMetadata(id), /INVALID_GITHUB_QUALITY_RUN_ID/);
  }
  assert.equal(spawn.mock.callCount(), 0);
});

test('GitHub lookup sanitizes failed commands and malformed JSON, never accepting partial metadata', async (t) => {
  const spawn = childProcess.spawn;
  for (const script of ['process.stderr.write("synthetic-secret");process.exit(1)',
    'process.stdout.write("not-json synthetic-secret")']) {
    const stub = t.mock.method(childProcess, 'spawn', (_command: string, _args: string[], options: SpawnOptions) =>
      spawn(process.execPath, ['-e', script], options));
    await assert.rejects(readGithubQualityMetadata(38129894832), (error: unknown) =>
      error instanceof BackupError && error.message === 'GITHUB_QUALITY_METADATA_UNAVAILABLE');
    assert.equal(stub.mock.callCount(), 1);
    stub.mock.restore();
  }
  let calls = 0;
  t.mock.method(childProcess, 'spawn', (_command: string, _args: string[], options: SpawnOptions) => {
    calls++;
    return spawn(process.execPath, ['-e', calls === 1 ? 'process.stdout.write("{}")' : 'process.exit(1)'], options);
  });
  await assert.rejects(readGithubQualityMetadata(38129894832), /GITHUB_QUALITY_METADATA_UNAVAILABLE/);
  assert.equal(calls, 2);
});

test('remote main lookup uses a fixed HTTPS target and credential helper without inherited Git/token overrides', async (t) => {
  const keys = ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_DEBUG', 'HOME', 'GH_CONFIG_DIR', 'HTTPS_PROXY',
    'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS',
    'GIT_TRACE', 'GIT_CURL_VERBOSE', 'GIT_SSL_NO_VERIFY', 'GIT_ASKPASS', 'GIT_DIR'] as const;
  const previous = keys.map(key => [key, process.env[key]] as const);
  for (const key of keys) process.env[key] = 'synthetic-untrusted-override';
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const sha = 'a'.repeat(40), spawn = childProcess.spawn;
  const stub = t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: SpawnOptions) => {
    assert.equal(command, '/usr/bin/git');
    assert.deepEqual(args, ['-C', '/', '-c', 'credential.helper=',
      '-c', 'credential.helper=/opt/homebrew/bin/gh auth git-credential', '-c', 'core.askPass=',
      '-c', 'http.sslVerify=true', '-c', 'http.followRedirects=false',
      'ls-remote', '--exit-code', '--refs', 'https://github.com/dhanis-alghifari/cms-sinegasi-picture.git', 'refs/heads/main']);
    assert.deepEqual(options.env, {
      PATH: '/usr/bin:/bin', LANG: 'C', HOME: '/Users/memberid',
      GH_CONFIG_DIR: '/Users/memberid/.config/gh', XDG_STATE_HOME: '/Users/memberid/.local/state',
      GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_TELEMETRY: '0',
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0',
    });
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.equal(options.detached, true);
    return spawn(process.execPath, ['-e', `process.stdout.write(${JSON.stringify(sha + '\trefs/heads/main\n')})`], options);
  });
  assert.equal(await readGithubMainSha(), sha);
  assert.equal(stub.mock.callCount(), 1);
});

test('remote main lookup rejects failure, malformed hashes, wrong refs and multiple results with sanitized errors', async (t) => {
  const spawn = childProcess.spawn, sha = 'a'.repeat(40);
  for (const output of ['', 'synthetic-secret', 'a'.repeat(39) + '\trefs/heads/main\n',
    sha + '\trefs/heads/develop\n', sha + '\trefs/heads/main\n' + sha + '\trefs/heads/main\n',
    sha + '\trefs/heads/main\nsynthetic-secret', 'x'.repeat(1025)]) {
    const stub = t.mock.method(childProcess, 'spawn', (_command: string, _args: string[], options: SpawnOptions) =>
      spawn(process.execPath, ['-e', `process.stdout.write(${JSON.stringify(output)})`], options));
    await assert.rejects(readGithubMainSha(), (error: unknown) =>
      error instanceof BackupError && error.message === 'GITHUB_MAIN_METADATA_UNAVAILABLE');
    stub.mock.restore();
  }
  t.mock.method(childProcess, 'spawn', (_command: string, _args: string[], options: SpawnOptions) =>
    spawn(process.execPath, ['-e', 'process.stderr.write("synthetic-secret");process.exit(128)'], options));
  await assert.rejects(readGithubMainSha(), /GITHUB_MAIN_METADATA_UNAVAILABLE/);
});
