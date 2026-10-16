import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { AUTH_ACCEPTANCE_CHECKS } from './authAcceptanceFlow.js';
import { AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_USER_ID, createAuthAcceptanceFixture,
  requireAuthAcceptanceArguments } from './authAcceptanceFixture.js';

const backend = resolve(__dirname, '../..');
const runner = resolve(__dirname, 'productionAuthAcceptance.ts');
function run(args: string[], disabled = true) {
  return spawnSync(process.execPath, ['--import', 'tsx', runner, ...args], {
    cwd: backend, encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    // Explicit, small environment: never forward operator credentials or .env settings.
    env: { PATH: process.env.PATH, TZ: 'UTC', ...(disabled ? { ENV_FILE_LOADING: 'disabled' } : {}) },
  });
}

test('auth preparation permits only offline plan and isolated rehearsal', () => {
  assert.equal(requireAuthAcceptanceArguments(['plan']), 'plan');
  assert.equal(requireAuthAcceptanceArguments(['rehearse']), 'rehearse');
  for (const args of [[], ['apply'], ['login'], ['inspect'], ['rehearse', '--keychain-ready'],
    ['plan', '--approval', 'old-bootstrap.json'], ['rehearse', '--url', 'https://example.com']]) {
    assert.throws(() => requireAuthAcceptanceArguments(args), /OFFLINE_PLAN_OR_ISOLATED_REHEARSAL_ONLY/);
  }
});

test('CLI rejects extra apply/approval arguments before accessing runtime or secrets', () => {
  const result = run(['apply', '--confirm-approval', 'b'.repeat(64)]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stderr);
  assert.equal(output.stage, 'OFFLINE_PLAN_OR_ISOLATED_REHEARSAL_ONLY');
  assert.equal(output.productionChanged, false);
  assert.equal(result.stdout, '');
});

test('CLI refuses .env loading before either preparation mode', () => {
  for (const mode of ['plan', 'rehearse']) {
    const result = run([mode], false);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).stage, 'ENV_FILE_LOADING_MUST_BE_DISABLED');
    assert.equal(result.stdout, '');
  }
});

test('offline plan explicitly requires new post-account recovery and write approval', () => {
  const result = run(['plan']);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, 'PRODUCTION_AUTH_OFFLINE_PLAN');
  assert.equal(plan.project, 'pvbdiftvzoeelibxlxzb');
  assert.equal(plan.username, 'admin');
  assert.equal(plan.role, 'teacher');
  for (const flag of ['productionExecutionImplemented', 'oldBootstrapApprovalReusable', 'keychainAccessed',
    'credentialFileRead', 'databaseAccessed', 'networkAccessed', 'productionChanged', 'deploymentPerformed', 'readyForPublicLaunch']) {
    assert.equal(plan[flag], false);
  }
  assert.ok(plan.nextProductionRequirements.includes('NEW_POST_BOOTSTRAP_BACKUP_RESTORE_AND_ENCRYPTED_COPY'));
  assert.ok(plan.nextProductionRequirements.includes('NEW_SCOPED_WRITE_APPROVAL_CHECKSUM_AND_WINDOW'));
  assert.ok(plan.nextProductionRequirements.includes('PREPARE_AND_TEST_SEPARATE_APPROVAL_GATED_MANAGED_EXECUTOR'));
  assert.ok(plan.isolatedOnlyChecks.includes('ATOMIC_VERSION_CONFLICT_FAILS_CLOSED'));
  assert.deepEqual(plan.checks, AUTH_ACCEPTANCE_CHECKS);
});

test('fresh process exercises actual Fastify first-login and password rotation path without network', () => {
  const result = run(['rehearse']);
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'ISOLATED_AUTH_ACCEPTANCE_PASSED');
  assert.deepEqual(receipt.checks, AUTH_ACCEPTANCE_CHECKS);
  assert.equal(receipt.fixture.version, 2);
  assert.equal(receipt.fixture.firstLogin, false);
  assert.equal(receipt.fixture.passwordChanges, 1);
  assert.equal(receipt.fixture.passwordRpcCalls, 2); // one simulated conflict; one success
  assert.equal(receipt.fixture.blocked, 0);
  assert.equal(receipt.realFastifyAuthRoutesTested, true);
  assert.equal(receipt.realPasswordHashAndJwtTested, true);
  assert.equal(receipt.realSupabaseSdkAdaptersTested, true);
  assert.equal(receipt.restStoreEmulated, true);
  for (const flag of ['databaseAtomicityTested', 'managedSupabaseIntegrationTested', 'productionLoginTested',
    'productionPasswordChanged', 'logoutServerRevocationImplemented', 'uiBrowserFlowTested', 'keychainAccessed',
    'credentialFileRead', 'networkAccessed', 'workersStarted', 'productionChanged', 'devDatabaseChanged', 'deploymentPerformed', 'readyForPublicLaunch']) {
    assert.equal(receipt[flag], false);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /scrypt\$|Bearer |"temporaryPassword"|"newPassword"|"token"/);
});

test('fixture cannot forward to live targets or accept private schema/other keys', async () => {
  const fixture = await createAuthAcceptanceFixture();
  const headers = { apikey: AUTH_FIXTURE_KEY };
  for (const url of ['https://pvbdiftvzoeelibxlxzb.supabase.co/rest/v1/users',
    'http://127.0.0.1/rest/v1/users', `${AUTH_FIXTURE_ORIGIN}.example.com/rest/v1/users`]) {
    await assert.rejects(fixture.fetch(url, { headers }), /FIXTURE_TARGET_BARRIER/);
  }
  const extraHeaders: Array<Record<string, string>> = [{ apikey: 'different-fixture-key' },
    { 'accept-profile': 'sinegasi_ops' }, { 'content-profile': 'auth' }];
  for (const extra of extraHeaders) {
    await assert.rejects(fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/users`, { headers: { ...headers, ...extra } }), /FIXTURE_TARGET_BARRIER/);
  }
  assert.equal(fixture.snapshot().requests, 0);
  assert.equal(fixture.snapshot().blocked, 6);
});

test('fixture refuses direct table mutations, unrelated reads and unknown RPCs', async () => {
  const fixture = await createAuthAcceptanceFixture();
  const headers = { apikey: AUTH_FIXTURE_KEY, 'content-type': 'application/json' };
  await assert.rejects(fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/users`, { method: 'DELETE', headers }), /FIXTURE_MUTATION_BARRIER/);
  await assert.rejects(fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/film_works?select=id`, { headers }), /FIXTURE_READ_NOT_ALLOWED/);
  await assert.rejects(fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/rpc/unreviewed`, { method: 'POST', headers,
    body: JSON.stringify({ p_rate_key: 'a'.repeat(64) }) }), /FIXTURE_RPC_NOT_ALLOWED/);
  assert.equal(fixture.snapshot().passwordChanges, 0);
});

test('fixture password RPC enforces actor scope and optimistic version', async () => {
  const fixture = await createAuthAcceptanceFixture();
  const rpc = (overrides: Record<string, unknown>) => fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/rpc/change_password_atomic`, {
    method: 'POST', headers: { apikey: AUTH_FIXTURE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ p_user_id: AUTH_FIXTURE_USER_ID, p_updated_by: AUTH_FIXTURE_USER_ID,
      p_password_hash: 'scrypt$synthetic-contract-placeholder-not-a-real-hash',
      p_expected_auth_version: 1, p_change_reason: 'Pengguna mengganti password akun', ...overrides }),
  });
  await assert.rejects(rpc({ p_updated_by: 'another-fixture-actor' }), /FIXTURE_PASSWORD_SCOPE_INVALID/);
  const stale = await rpc({ p_expected_auth_version: 2 });
  assert.equal(stale.status, 400);
  assert.equal(fixture.snapshot().version, 1);
  assert.equal(fixture.snapshot().passwordChanges, 0);
  assert.equal((await rpc({})).status, 200);
  assert.equal((await rpc({})).status, 400);
  assert.equal(fixture.snapshot().version, 2);
  assert.equal(fixture.snapshot().passwordChanges, 1);
});

test('fixture request budget caps unexpected loops without opening sockets', async () => {
  const fixture = await createAuthAcceptanceFixture();
  for (let count = 0; count < 250; count++) await fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/students?select=id&user_id=eq.${AUTH_FIXTURE_USER_ID}`,
    { headers: { apikey: AUTH_FIXTURE_KEY } });
  await assert.rejects(fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/students`, { headers: { apikey: AUTH_FIXTURE_KEY } }), /FIXTURE_REQUEST_BUDGET_EXCEEDED/);
  assert.equal(fixture.snapshot().requests, 250);
});

test('fixture distinguishes cancelled SDK requests from an escaped-target attempt', async () => {
  const fixture = await createAuthAcceptanceFixture();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fixture.fetch(`${AUTH_FIXTURE_ORIGIN}/rest/v1/users`, {
    headers: { apikey: AUTH_FIXTURE_KEY }, signal: controller.signal,
  }), { name: 'AbortError' });
  assert.equal(fixture.snapshot().abortedRequests, 1);
  assert.equal(fixture.snapshot().blocked, 0);
  assert.equal(fixture.snapshot().requests, 0);
});

test('runner has no live credential, apply, listen, worker or deployment entry point', async () => {
  const source = await readFile(runner, 'utf8');
  assert.doesNotMatch(source, /readKeychain\(|readFile\(|\.listen\(|\.startWorkers\(|execFile\(|spawn\(/);
  assert.match(source, /globalThis.fetch = fixture.fetch/);
  assert.match(source, /FRESH_ISOLATED_PROCESS_REQUIRED/);
});
