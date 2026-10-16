import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  BACKEND_CUSTODY_DESTINATION, BACKEND_CUSTODY_FIXED_ENV, BACKEND_CUSTODY_ITEMS,
  backendCustodyFailure, backendCustodyPayload, backendCustodyPlan, parseBackendCustodyCommand,
  provisionBackendCustody, requireBackendCustodyPreflight, type BackendCustodyState,
} from './productionBackendCustodyCore.js';

const values = ['sb_secret_' + 'synthetic'.repeat(4), '1'.repeat(32), '2'.repeat(64)];
const safeEnv = { ENV_FILE_LOADING: 'disabled' };
function initial(): BackendCustodyState {
  return { inspectionAttempts: 0, keychainReadsAttempted: 0, transferAttempts: 0, transferAcknowledged: false };
}
function preflight(): Record<string, unknown> {
  return { status: 'BACKEND_CUSTODY_DESTINATION_READY', destination: BACKEND_CUSTODY_DESTINATION, owner: 'ubuntu',
    destinationAbsent: true, privateParentsReady: true, r2CustodyMetadataVerified: true, configurationContentsRead: false };
}
function fileBytes(): number {
  return Buffer.byteLength(Object.entries(BACKEND_CUSTODY_FIXED_ENV).map(([key, value]) => `${key}=${value}\n`).join('')
    + `SUPABASE_SERVICE_ROLE_KEY=${values[0]}\nJWT_SECRET=${'0'.repeat(128)}\n`
    + `CLOUDFLARE_R2_ACCESS_KEY_ID=${values[1]}\nCLOUDFLARE_R2_SECRET_ACCESS_KEY=${values[2]}\n`);
}
function receipt(): Record<string, unknown> {
  return { status: 'BACKEND_CUSTODY_CREATED', destination: BACKEND_CUSTODY_DESTINATION, owner: 'ubuntu',
    mode: '0600', directoryMode: '0700', bytes: fileBytes(), nlink: 1, contentReadBack: false,
    existingFileOverwritten: false, temporaryRemoved: true, appJwtGenerated: true, appJwtRandomBytes: 64,
    r2CustodyMetadataUnchanged: true, managedSupabaseSigningKeyChanged: false };
}

test('backend custody requires all exact consent flags and a clean environment', () => {
  assert.equal(parseBackendCustodyCommand(['plan'], safeEnv), 'plan');
  assert.equal(parseBackendCustodyCommand(['inspect'], safeEnv), 'inspect');
  assert.equal(parseBackendCustodyCommand(['apply', '--backend-custody-approved', '--generate-app-jwt-approved', '--keychain-ready'], safeEnv), 'apply');
  for (const args of [[], ['apply'], ['apply', '--transfer-approved', '--keychain-ready'],
    ['apply', '--backend-custody-approved', '--keychain-ready'], ['plan', '--host', 'other'], ['inspect', '--keychain-ready']]) {
    assert.throws(() => parseBackendCustodyCommand(args, safeEnv));
  }
  for (const key of ['DEBUG', 'NODE_DEBUG', 'NODE_OPTIONS', 'SSLKEYLOGFILE']) {
    assert.throws(() => parseBackendCustodyCommand(['plan'], { ...safeEnv, [key]: 'unsafe' }));
  }
  assert.throws(() => parseBackendCustodyCommand(['plan'], {}));
  assert.throws(() => parseBackendCustodyCommand(['plan'], { ...safeEnv, NODE_TLS_REJECT_UNAUTHORIZED: '0' }));
});

test('offline plan has fixed custody, disabled proxy trust, no managed signing-key rotation or deployment', () => {
  const plan = backendCustodyPlan();
  for (const key of ['keychainAccessed', 'networkAccessed', 'configurationContentsRead', 'credentialsTransferred',
    'vpsCustodyChanged', 'backendRuntimeConfigured', 'databaseAccessed', 'deploymentPerformed', 'proxyTopologyApproved']) {
    assert.equal(plan[key], false);
  }
  assert.equal(BACKEND_CUSTODY_ITEMS.length, 3);
  assert.equal(BACKEND_CUSTODY_ITEMS[0].account, 'pvbdiftvzoeelibxlxzb');
  assert.equal(BACKEND_CUSTODY_FIXED_ENV.TRUST_PROXY, '0');
  assert.equal(plan.managedSupabaseSigningKeyChanged, false);
  assert.equal(plan.supabaseKeyAuthenticityVerified, false);
});

test('stdin payload has only the three approved keys, no JWT or config override', () => {
  const payload = backendCustodyPayload(values.map(value => value + '\n'));
  assert.deepEqual(JSON.parse(payload.toString('ascii')), { supabaseKey: values[0], r2AccessKeyId: values[1], r2SecretAccessKey: values[2] });
  assert.ok(!payload.includes(Buffer.from('JWT_SECRET')));
  for (const changes of [[], [...values, 'extra'], ['sb_publishable_' + 'x'.repeat(32), ...values.slice(1)],
    [values[0] + '\nDATABASE_URL=bad', ...values.slice(1)], [values[0], 'g'.repeat(32), values[2]],
    [values[0], values[1], values[2] + '\n\n']]) assert.throws(() => backendCustodyPayload(changes));
  payload.fill(0);
});

test('legacy backend key rejects wrong role/project/expiry before transferring', () => {
  function legacy(changes: Record<string, unknown> = {}): string {
    const claims = { ref: 'pvbdiftvzoeelibxlxzb', role: 'service_role', exp: 4102444800, ...changes };
    return `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.c3ludGhldGlj`;
  }
  const payload = backendCustodyPayload([legacy(), ...values.slice(1)]);
  assert.ok(payload.length > 0); payload.fill(0);
  for (const changes of [{ ref: 'wrong-project' }, { role: 'anon' }, { exp: 1 }, { exp: '4102444800' }]) {
    assert.throws(() => backendCustodyPayload([legacy(changes), ...values.slice(1)]));
  }
});

test('preflight requires existing private parents and R2 metadata; unsafe targets never read credentials', async () => {
  requireBackendCustodyPreflight(preflight());
  for (const patch of [{ destinationAbsent: false }, { destination: '/opt/dev/backend.env' }, { owner: 'root' },
    { privateParentsReady: false }, { r2CustodyMetadataVerified: false }, { configurationContentsRead: true }, { extra: 'unexpected' }]) {
    const state = initial();
    await assert.rejects(provisionBackendCustody(async () => { throw new Error('must not read'); },
      async () => ({ ...preflight(), ...patch }), state), /VPS_PREFLIGHT_FAILED/);
    assert.equal(state.keychainReadsAttempted, 0); assert.equal(state.transferAttempts, 0);
  }
});

test('one transfer only, exact item/account allowlist, receipt metadata and buffer cleanup', async () => {
  const state = initial(), reads: string[] = [], actions: string[] = [];
  let retained: Buffer | undefined;
  const result = await provisionBackendCustody(async (item) => {
    const index = BACKEND_CUSTODY_ITEMS.findIndex(allowed => item.service === allowed.service && item.account === allowed.account);
    reads.push(item.service); return values[index];
  }, async (action, input) => {
    actions.push(action);
    if (action === 'inspect') { assert.equal(input.length, 0); return preflight(); }
    retained = input; assert.deepEqual(input, backendCustodyPayload(values)); return receipt();
  }, state);
  assert.deepEqual(reads, BACKEND_CUSTODY_ITEMS.map(item => item.service));
  assert.deepEqual(actions, ['inspect', 'write']);
  assert.equal(state.transferAttempts, 1); assert.equal(state.transferAcknowledged, true);
  assert.equal(result.credentialsTransferred, true); assert.equal(result.vpsCustodyChanged, true);
  assert.equal(result.backendRuntimeConfigured, false); assert.equal(result.fileReadBackIntegrityVerified, false);
  assert.equal(result.deploymentPerformed, false);
  assert.ok(retained?.every(byte => byte === 0));
  for (const value of values) assert.ok(!JSON.stringify(result).includes(value));
});

test('denied or malformed item stops before transfer and error text cannot disclose keys', async () => {
  for (const mode of ['denied', 'malformed']) {
    const state = initial();
    await assert.rejects(provisionBackendCustody(async () => {
      if (mode === 'denied') throw new Error(values[0]);
      return 'invalid';
    }, async (action) => { assert.equal(action, 'inspect'); return preflight(); }, state));
    assert.equal(state.keychainReadsAttempted, 1); assert.equal(state.transferAttempts, 0);
    assert.ok(!JSON.stringify(backendCustodyFailure(new Error(values[0]), state)).includes(values[0]));
  }
});

test('uncertain outcome or mismatched receipt never retries, regenerates, resets or deletes', async () => {
  for (const invalid of [null, { ...receipt(), bytes: 1 }, { ...receipt(), extra: values[0] },
    { ...receipt(), r2CustodyMetadataUnchanged: false }, { ...receipt(), appJwtRandomBytes: 16 }]) {
    const state = initial(); let writes = 0;
    await assert.rejects(provisionBackendCustody(async item => values[BACKEND_CUSTODY_ITEMS.indexOf(item)], async (action) => {
      if (action === 'inspect') return preflight();
      writes++;
      if (invalid === null) throw new Error(values[0]);
      return invalid;
    }, state), /TRANSFER_OUTCOME_UNCERTAIN/);
    assert.equal(writes, 1); assert.equal(state.transferAcknowledged, false);
    const failure = backendCustodyFailure(new Error(values[0]), state);
    assert.equal(failure.destinationMayExist, true); assert.equal(failure.automaticRetryAllowed, false);
    assert.equal(failure.appJwtMayHaveBeenGenerated, true);
    assert.ok(!JSON.stringify(failure).includes(values[0]));
    await assert.rejects(provisionBackendCustody(async () => { throw new Error('must not read'); },
      async () => { throw new Error('must not connect'); }, state), /STATE_REUSED/);
  }
});

test('Python receiver abuse cases stay in memory and non-secret fixed fields match TypeScript', () => {
  const python = ['/usr/bin/python3', '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3'].find(existsSync);
  assert.ok(python, 'Python is required for isolated receiver tests');
  const output = execFileSync(python, ['-I', '-B', resolve(__dirname, '../../../ops/provision-backend-custody-vps.test.py')],
    { env: { PATH: '/usr/bin:/bin' }, timeout: 10_000, encoding: 'utf8', maxBuffer: 8192 });
  assert.match(output, /BACKEND_RECEIVER_IN_MEMORY_TESTS_PASSED 11/);
  const fixed = output.split('\n').find(line => line.startsWith('FIXED_ENVIRONMENT '));
  assert.ok(fixed); assert.deepEqual(JSON.parse(fixed.slice('FIXED_ENVIRONMENT '.length)), BACKEND_CUSTODY_FIXED_ENV);
});

test('fixed draft passes actual runtime config and production preflight using synthetic credentials only', () => {
  const preflightSource = readFileSync(resolve(__dirname, '../../../ops/production-runtime-preflight.cjs'), 'utf8');
  const script = `
    import { runInNewContext } from 'node:vm';
    const { runtimeConfig } = await import('./src/config/env.ts');
    runInNewContext(${JSON.stringify(preflightSource)}, {
      require: () => ({ runtimeConfig }), process: { env: process.env, stderr: { write() {} }, exit() { throw new Error('PREFLIGHT_FAILED'); } }
    });
    console.log('SYNTHETIC_BACKEND_CONFIG_PASSED');
  `;
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: resolve(__dirname, '../..'), encoding: 'utf8', timeout: 10_000, maxBuffer: 2048,
    env: { PATH: '/usr/bin:/bin', ...BACKEND_CUSTODY_FIXED_ENV, SUPABASE_SERVICE_ROLE_KEY: values[0],
      JWT_SECRET: '3'.repeat(128), CLOUDFLARE_R2_ACCESS_KEY_ID: values[1], CLOUDFLARE_R2_SECRET_ACCESS_KEY: values[2],
      PRODUCTION_TRUST_PROXY: '0', PRODUCTION_TRUST_PROXY_ADDRESSES: 'none', PRODUCTION_R2_ACCOUNT_ID: BACKEND_CUSTODY_FIXED_ENV.CLOUDFLARE_R2_ACCOUNT_ID,
      PRODUCTION_R2_BUCKET: BACKEND_CUSTODY_FIXED_ENV.CLOUDFLARE_R2_BUCKET_NAME },
  });
  assert.match(output, /SYNTHETIC_BACKEND_CONFIG_PASSED/);
});
