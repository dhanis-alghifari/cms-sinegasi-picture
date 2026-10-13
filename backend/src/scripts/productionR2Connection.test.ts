import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  R2_CONNECTION_BUCKET, R2_CONNECTION_ORIGIN, R2_CONNECTION_SERVICES, R2ConnectionError,
  parseR2ConnectionCommand, r2ConnectionFailure, requireFixedR2Head, sendR2HeadBucket,
  signedR2HeadBucket, verifyR2Connection, type R2ConnectionState, type R2HeadRequest,
} from './productionR2ConnectionCore.js';

const access = '1'.repeat(32), secret = '2'.repeat(64), instant = new Date('2026-10-13T12:00:00.000Z');
function state(): R2ConnectionState { return { keychainReadsAttempted: 0, headBucketAttempts: 0 }; }
function cli(args: string[], extraEnv: NodeJS.ProcessEnv = {}): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ['--import', 'tsx', resolve(__dirname, 'productionR2Connection.ts'), ...args], {
    cwd: resolve(__dirname, '../..'), encoding: 'utf8', timeout: 10_000,
    env: { PATH: '/usr/bin:/bin', ENV_FILE_LOADING: 'disabled', ...extraEnv },
  });
}
function reader(service: string): Promise<string> {
  return Promise.resolve(service === R2_CONNECTION_SERVICES[0] ? access + '\n' : secret + '\n');
}

test('command gate permits only offline plan or explicit Keychain-ready verification', () => {
  assert.equal(parseR2ConnectionCommand(['plan'], { ENV_FILE_LOADING: 'disabled' }), 'plan');
  assert.equal(parseR2ConnectionCommand(['verify', '--keychain-ready'], { ENV_FILE_LOADING: 'disabled' }), 'verify');
  for (const args of [[], ['verify'], ['apply'], ['upload'], ['list'], ['plan', '--keychain-ready'],
    ['verify', '--keychain-ready', '--bucket', 'cms-dashboard-storage-dev'], ['verify', '--keychain-ready', '--force']]) {
    assert.throws(() => parseR2ConnectionCommand(args, { ENV_FILE_LOADING: 'disabled' }));
  }
});

test('unsafe environment and CLI overrides fail before Keychain/network access', () => {
  for (const env of [{ ENV_FILE_LOADING: 'enabled' }, { ENV_FILE_LOADING: '' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { NODE_DEBUG: 'http' }, { DEBUG: '*' }, { SSLKEYLOGFILE: '/tmp/not-created' }]) {
    const result = cli(['plan'], env);
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    const receipt = JSON.parse(String(result.stderr));
    assert.equal(receipt.code, 'UNSAFE_ENVIRONMENT'); assert.equal(receipt.headBucketAttempts, 0);
    assert.equal(receipt.keychainReadsAttempted, 0);
  }
  assert.throws(() => parseR2ConnectionCommand(['plan'], { ENV_FILE_LOADING: 'disabled', NODE_OPTIONS: '--inspect' }));
  for (const args of [['verify'], ['verify', '--keychain-ready', '--url', 'https://evil.invalid']]) {
    const result = cli(args); assert.equal(result.status, 1);
    assert.equal(JSON.parse(String(result.stderr)).keychainReadsAttempted, 0);
  }
});

test('plan is metadata only and makes no claims about token scope, files or launch readiness', () => {
  const result = cli(['plan']); assert.equal(result.status, 0, String(result.stderr));
  const plan = JSON.parse(String(result.stdout));
  assert.equal(plan.operation, 'HeadBucket'); assert.equal(plan.maximumRequests, 1);
  assert.equal(plan.bucket, R2_CONNECTION_BUCKET);
  for (const key of ['keychainAccessed', 'networkAccessed', 'envFileRead', 'objectsListed', 'objectContentsRead',
    'objectWritesPerformed', 'credentialsBucketScopedVerified', 'productionChanged', 'deploymentPerformed', 'readyForPublicLaunch']) {
    assert.equal(plan[key], false);
  }
  assert.equal(plan.automaticRetryAllowed, false); assert.equal(plan.redirectsAllowed, false);
  assert.doesNotMatch(String(result.stdout), /AWS4-HMAC|Signature=|Credential=/);
});

test('SigV4 canonical request signs fixed HEAD/path/host/date/empty payload using auto/s3', () => {
  const request = signedR2HeadBucket(access, secret, instant);
  const bodyHash = createHash('sha256').update('').digest('hex');
  const canonical = `HEAD\n/${R2_CONNECTION_BUCKET}\n\nhost:${new URL(R2_CONNECTION_ORIGIN).hostname}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:20261013T120000Z\n\nhost;x-amz-content-sha256;x-amz-date\n${bodyHash}`;
  let key: Buffer = Buffer.from('AWS4' + secret);
  for (const part of ['20261013', 'auto', 's3', 'aws4_request']) key = createHmac('sha256', key).update(part).digest();
  const expected = createHmac('sha256', key).update('AWS4-HMAC-SHA256\n20261013T120000Z\n20261013/auto/s3/aws4_request\n'
    + createHash('sha256').update(canonical).digest('hex')).digest('hex');
  assert.ok(request.headers.authorization.endsWith('Signature=' + expected));
  assert.equal(request.method, 'HEAD'); assert.equal(request.url, `${R2_CONNECTION_ORIGIN}/${R2_CONNECTION_BUCKET}`);
  assert.equal(new URL(request.url).search, ''); requireFixedR2Head(request);
  assert.ok(Object.isFrozen(request)); assert.ok(Object.isFrozen(request.headers));
});

test('transport rejects body, object paths, list query, DEV, wrong host/method/headers before networking', async () => {
  const request = signedR2HeadBucket(access, secret, instant);
  const changes: Array<Record<string, unknown>> = [{ method: 'GET' }, { method: 'PUT' }, { body: 'data' },
    { url: request.url + '/photo.png' }, { url: request.url + '?list-type=2' }, { url: request.url + '-dev' },
    { url: request.url.replace('https:', 'http:') }, { url: 'https://evil.invalid/' },
    { headers: { ...request.headers, host: 'evil.invalid' } }, { headers: { ...request.headers, cookie: 'x' } },
    { headers: { ...request.headers, authorization: 'Bearer x' } }, { headers: { ...request.headers, 'x-amz-date': '\r\n' } }];
  for (const change of changes) {
    await assert.rejects(sendR2HeadBucket({ ...request, ...change } as R2HeadRequest), { code: 'REQUEST_OUTSIDE_SCOPE' });
  }
});

test('malformed, whitespace, wrong length and injection credentials never reach transport', async () => {
  for (const bad of ['', 'not a key', access + ' ', ' ' + access, access + '\n\n', access + '\r\nInjected: true', 'z'.repeat(32)]) {
    const s = state(); let requests = 0;
    await assert.rejects(verifyR2Connection(async () => bad, async () => { requests++; return 200; }, s), { code: 'INVALID_CREDENTIAL' });
    assert.equal(requests, 0); assert.equal(s.headBucketAttempts, 0);
  }
  assert.throws(() => signedR2HeadBucket(access, access, instant), { code: 'INVALID_CREDENTIAL' });
  assert.throws(() => signedR2HeadBucket(access, secret, new Date('invalid')), { code: 'INVALID_TIMESTAMP' });
});

test('successful isolated adapter reads exactly two approved services and sends exactly one HEAD', async () => {
  const services: string[] = [], s = state(); let requests = 0;
  const receipt = await verifyR2Connection(async (service) => { services.push(service); return reader(service); }, async (request) => {
    requireFixedR2Head(request); requests++; return 200;
  }, s, () => instant);
  assert.deepEqual(services, R2_CONNECTION_SERVICES); assert.equal(requests, 1);
  assert.equal(receipt.status, 'PRODUCTION_R2_HEAD_BUCKET_VERIFIED'); assert.equal(receipt.httpStatus, 200);
  assert.equal(receipt.keychainReadsAttempted, 2); assert.equal(receipt.headBucketAttempts, 1);
  assert.equal(receipt.credentialsBucketScopedVerified, false); assert.equal(receipt.browserMediaFlowTested, false);
  assert.equal(receipt.backendRuntimeConfigured, false); assert.equal(receipt.productionChanged, false);
  assert.doesNotMatch(JSON.stringify(receipt), new RegExp(`${access}|${secret}|Signature=|authorization|Credential=`));
  await assert.rejects(verifyR2Connection(reader, async () => 200, s), { code: 'REQUEST_OUTSIDE_SCOPE' });
});

test('all non-200 statuses fail closed without redirect, retry or asserting invalid key', async () => {
  for (const httpStatus of [201, 204, 301, 302, 307, 400, 403, 404, 429, 500, 503, NaN, 700]) {
    const s = state(); let requests = 0;
    await assert.rejects(verifyR2Connection(reader, async () => { requests++; return httpStatus; }, s, () => instant), { code: 'R2_HTTP_FAILED' });
    assert.equal(requests, 1); assert.equal(s.headBucketAttempts, 1);
  }
});

test('Keychain failure/denial stops before HTTP and discards raw secret diagnostics', async () => {
  const s = state(); let requests = 0;
  try {
    await verifyR2Connection(async () => { throw new Error(secret); }, async () => { requests++; return 200; }, s);
    assert.fail('expected failure');
  } catch (error: unknown) {
    assert.equal(requests, 0); assert.equal(s.keychainReadsAttempted, 1);
    const receipt = r2ConnectionFailure(error, s);
    assert.equal(receipt.code, 'KEYCHAIN_READ_FAILED'); assert.ok(!JSON.stringify(receipt).includes(secret));
  }
});

test('timeout/network errors are sanitized, make one attempt, and never request replacement secrets', async () => {
  const s = state(); let requests = 0;
  try {
    await verifyR2Connection(reader, async () => { requests++; throw new Error(secret + ' authorization'); }, s);
    assert.fail('expected failure');
  } catch (error: unknown) {
    assert.equal(requests, 1); const receipt = r2ConnectionFailure(error, s);
    assert.equal(receipt.code, 'R2_TRANSPORT_FAILED'); assert.ok(!JSON.stringify(receipt).includes(secret));
    assert.equal(receipt.automaticRetryAllowed, false); assert.equal(receipt.productionChanged, false);
  }
  assert.equal(r2ConnectionFailure(new Error(secret), state()).code, 'UNEXPECTED_FAILURE');
  assert.equal(r2ConnectionFailure(new R2ConnectionError('R2_HTTP_FAILED', 403), s).httpStatus, 403);
});
