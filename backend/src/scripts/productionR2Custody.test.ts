import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  parseR2CustodyCommand, provisionR2Custody, r2CustodyFailure, r2CustodyPayload,
  r2CustodyPlan, requireCustodyPreflight, R2_CUSTODY_DESTINATION, R2_CUSTODY_SSH_ARGS,
  type R2CustodyState,
} from './productionR2CustodyCore.js';
import { R2_CONNECTION_SERVICES } from './productionR2ConnectionCore.js';

const fixtureAccess = '1'.repeat(32), fixtureSecret = '2'.repeat(64);
const safeEnv = { ENV_FILE_LOADING: 'disabled' };
function initial(): R2CustodyState {
  return { inspectionAttempts: 0, keychainReadsAttempted: 0, transferAttempts: 0, transferAcknowledged: false };
}
function preflight(): Record<string, unknown> {
  return { status: 'R2_CUSTODY_DESTINATION_READY', destination: R2_CUSTODY_DESTINATION, owner: 'ubuntu',
    destinationAbsent: true, privateParentsReady: true, directoryCreationRequired: false, configurationContentsRead: false };
}
function receipt(bytes: number): Record<string, unknown> {
  return { status: 'R2_CUSTODY_CREATED', destination: R2_CUSTODY_DESTINATION, owner: 'ubuntu', mode: '0600',
    directoryMode: '0700', bytes, nlink: 1, contentReadBack: false, existingFileOverwritten: false, temporaryRemoved: true };
}

test('custody commands require exact flags and clean environment', () => {
  assert.equal(parseR2CustodyCommand(['plan'], safeEnv), 'plan');
  assert.equal(parseR2CustodyCommand(['inspect'], safeEnv), 'inspect');
  assert.equal(parseR2CustodyCommand(['apply', '--transfer-approved', '--keychain-ready'], safeEnv), 'apply');
  for (const args of [[], ['apply'], ['apply', '--keychain-ready'], ['plan', '--host', 'other'], ['inspect', '--keychain-ready']]) {
    assert.throws(() => parseR2CustodyCommand(args, safeEnv));
  }
  for (const key of ['DEBUG', 'NODE_DEBUG', 'NODE_OPTIONS', 'SSLKEYLOGFILE']) {
    assert.throws(() => parseR2CustodyCommand(['plan'], { ...safeEnv, [key]: 'unsafe' }));
  }
  assert.throws(() => parseR2CustodyCommand(['plan'], {}));
});

test('plan is inert and SSH pins host identity without forwarding or retries', () => {
  const plan = r2CustodyPlan();
  assert.equal(plan.keychainAccessed, false);
  assert.equal(plan.credentialsTransferred, false);
  assert.equal(plan.backendRuntimeConfigured, false);
  assert.equal(plan.configurationContentsRead, false);
  assert.equal(plan.deploymentPerformed, false);
  assert.equal(R2_CUSTODY_SSH_ARGS.at(-1), 'ubuntu@43.157.242.8');
  for (const flag of ['StrictHostKeyChecking=yes', 'ForwardAgent=no', 'ClearAllForwardings=yes', 'BatchMode=yes', 'ConnectionAttempts=1']) {
    assert.ok(R2_CUSTODY_SSH_ARGS.includes(flag as typeof R2_CUSTODY_SSH_ARGS[number]));
  }
});

test('payload contains only four R2 variables and rejects injection', () => {
  const payload = r2CustodyPayload(fixtureAccess + '\n', fixtureSecret + '\r\n');
  assert.equal(payload.toString('ascii').split('\n').filter(Boolean).length, 4);
  assert.ok(!payload.toString('ascii').includes('SUPABASE'));
  for (const bad of [' ', fixtureAccess + '\n\n', fixtureAccess + '\nJWT_SECRET=bad', 'g'.repeat(32)]) {
    assert.throws(() => r2CustodyPayload(bad, fixtureSecret));
  }
  assert.throws(() => r2CustodyPayload(fixtureAccess, fixtureSecret + ' '));
  payload.fill(0);
});

test('metadata preflight fails closed for destination/path/owner/shape changes', () => {
  requireCustodyPreflight(preflight());
  requireCustodyPreflight({ ...preflight(), privateParentsReady: false, directoryCreationRequired: true });
  for (const patch of [{ destination: '/opt/dev/r2.env' }, { owner: 'root' }, { destinationAbsent: false },
    { configurationContentsRead: true }, { privateParentsReady: 'true' }, { extra: 'not permitted' }]) {
    assert.throws(() => requireCustodyPreflight({ ...preflight(), ...patch }));
  }
});

test('unsafe VPS fails before any credential reads', async () => {
  const state = initial();
  let reads = 0;
  await assert.rejects(provisionR2Custody(async () => { reads++; return fixtureAccess; },
    async () => ({ ...preflight(), destinationAbsent: false }), state), /VPS_PREFLIGHT_FAILED/);
  assert.equal(reads, 0); assert.equal(state.transferAttempts, 0);
});

test('single scoped transfer acknowledges only a validated receipt and zeroizes input', async () => {
  const state = initial(), reads: string[] = [], actions: string[] = [];
  let retained: Buffer | undefined;
  const result = await provisionR2Custody(async (service) => {
    reads.push(service); return service === R2_CONNECTION_SERVICES[0] ? fixtureAccess : fixtureSecret;
  }, async (action, input) => {
    actions.push(action);
    if (action === 'inspect') { assert.equal(input.length, 0); return preflight(); }
    retained = input;
    assert.deepEqual(input, r2CustodyPayload(fixtureAccess, fixtureSecret));
    return receipt(input.length);
  }, state);
  assert.deepEqual(reads, [...R2_CONNECTION_SERVICES]); assert.deepEqual(actions, ['inspect', 'write']);
  assert.equal(state.transferAttempts, 1); assert.equal(state.transferAcknowledged, true);
  assert.equal(result.credentialsTransferred, true); assert.equal(result.deploymentPerformed, false);
  assert.equal(result.fileReadBackIntegrityVerified, false);
  assert.ok(retained?.every((byte) => byte === 0));
  assert.ok(!JSON.stringify(result).includes(fixtureAccess)); assert.ok(!JSON.stringify(result).includes(fixtureSecret));
});

test('credential denial and malformed credential never transfer or expose diagnostics', async () => {
  for (const mode of ['deny', 'malformed']) {
    const state = initial();
    await assert.rejects(provisionR2Custody(async () => {
      if (mode === 'deny') throw new Error(fixtureSecret);
      return 'bad';
    }, async (action) => { assert.equal(action, 'inspect'); return preflight(); }, state));
    const failure = r2CustodyFailure(new Error(fixtureSecret), state);
    assert.equal(state.transferAttempts, 0);
    assert.ok(!JSON.stringify(failure).includes(fixtureSecret));
  }
});

test('network failure or invalid write receipt is uncertain with no retry', async () => {
  for (const badReceipt of [null, { ...receipt(1), owner: 'root' }, { ...receipt(1), extra: fixtureSecret }]) {
    const state = initial(); let writes = 0;
    await assert.rejects(provisionR2Custody(async (service) => service === R2_CONNECTION_SERVICES[0] ? fixtureAccess : fixtureSecret,
      async (action) => {
        if (action === 'inspect') return preflight();
        writes++;
        if (badReceipt === null) throw new Error(fixtureSecret);
        return badReceipt;
      }, state), /TRANSFER_OUTCOME_UNCERTAIN/);
    assert.equal(writes, 1);
    const result = r2CustodyFailure(new Error(fixtureSecret), state);
    assert.equal(result.destinationMayExist, true); assert.equal(result.automaticRetryAllowed, false);
    assert.ok(!JSON.stringify(result).includes(fixtureSecret));
  }
});

test('reusing an attempt state is rejected without adapters', async () => {
  const state = { ...initial(), transferAttempts: 1 };
  await assert.rejects(provisionR2Custody(async () => { throw new Error('must not read'); },
    async () => { throw new Error('must not request'); }, state), /STATE_REUSED/);
});

test('remote receiver filesystem abuse cases use an in-memory OS, not the VPS', () => {
  const python = [
    '/usr/bin/python3', '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3',
  ].find(existsSync);
  assert.ok(python, 'Python is required for offline receiver tests; do not silently skip');
  const output = execFileSync(python, ['-I', '-B', resolve(__dirname, '../../../ops/provision-r2-custody-vps.test.py')],
    { env: { PATH: '/usr/bin:/bin' }, timeout: 10_000, encoding: 'utf8', maxBuffer: 8192 });
  assert.match(output, /R2_RECEIVER_IN_MEMORY_TESTS_PASSED/);
});
