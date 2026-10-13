import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_USER_ID, createAuthAcceptanceFixture,
  requireAuthAcceptanceArguments } from './authAcceptanceFixture.js';
import { AUTH_VERIFICATION_CHECKS, createIsolatedVerificationAttempt, runAuthVerificationFlow,
  type AuthVerificationDependencies } from './authVerificationFlow.js';
import { createIsolatedAuthVerificationTransport } from './productionAuthTransport.js';

const backend = resolve(__dirname, '../..');
const runner = resolve(__dirname, 'productionAuthVerification.ts');
const scope = { origin: AUTH_FIXTURE_ORIGIN, key: AUTH_FIXTURE_KEY, userId: AUTH_FIXTURE_USER_ID,
  username: 'fixture_guru', deadline: Date.now() + 60_000, beforeRequest() {} };
function transport(upstream: typeof fetch = async () => new Response('[]')) {
  return createIsolatedAuthVerificationTransport({ ...scope, deadline: Date.now() + 60_000 }, upstream);
}
function read(path = '/rest/v1/users?select=id&id=eq.' + scope.userId, headers: Record<string, string> = {}) {
  return new Request(scope.origin + path, { headers: { apikey: scope.key, ...headers } });
}
function rpc(name: string, body: Record<string, unknown>) {
  return new Request(scope.origin + '/rest/v1/rpc/' + name, { method: 'POST',
    headers: { apikey: scope.key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
function child(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', ...args], { cwd: backend, encoding: 'utf8', timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024, env: { PATH: process.env.PATH, TZ: 'UTC', ENV_FILE_LOADING: 'disabled', ...env } });
}
function fault(code: string) {
  return child(['-e', `(async () => {
    const { createAuthAcceptanceFixture } = require('./src/scripts/authAcceptanceFixture.ts');
    const { rehearseAuthVerification } = require('./src/scripts/productionAuthVerification.ts');
    const fixture = await createAuthAcceptanceFixture('rotated');
    ${code}
    try { await rehearseAuthVerification(fixture); console.log(JSON.stringify({ status: 'UNEXPECTED_PASS' })); }
    catch (error) { console.log(JSON.stringify({ status: 'EXPECTED_STOP', stage: error.stage || 'SANITIZED_FAILURE', fixture: fixture.snapshot() })); }
  })().catch(() => { process.exitCode = 1; });`]);
}

test('post-rotation verifier has only offline plan/rehearse; old approvals cannot select apply', () => {
  for (const args of [[], ['apply'], ['inspect'], ['login'], ['reset'], ['plan', '--keychain-ready'],
    ['rehearse', '--password', 'untrusted'], ['apply', '--confirm-approval', '6c4ebf76aaf1e21d1e309e09209b1ff625e3504c15cf1661697d5ad27d2de58c']]) {
    assert.throws(() => requireAuthAcceptanceArguments(args), /OFFLINE_PLAN_OR_ISOLATED_REHEARSAL_ONLY/);
  }
  const result = child([runner, 'apply', '--keychain-ready']);
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.equal(JSON.parse(result.stderr).stage, 'OFFLINE_PLAN_OR_ISOLATED_REHEARSAL_ONLY');
});

test('CLI refuses environment loading or disabled TLS before either offline mode', () => {
  for (const mode of ['plan', 'rehearse']) {
    for (const [env, stage] of [[{ ENV_FILE_LOADING: 'enabled' }, 'ENV_FILE_LOADING_MUST_BE_DISABLED'],
      [{ NODE_TLS_REJECT_UNAUTHORIZED: '0' }, 'TLS_VERIFICATION_MUST_REMAIN_ENABLED']] as const) {
      const result = child([runner, mode], env);
      assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.equal(JSON.parse(result.stderr).stage, stage);
    }
  }
});

test('offline plan declares version two, counter writes and separate unimplemented production gates', () => {
  const result = child([runner, 'plan']); assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, 'POST_ROTATION_AUTH_VERIFICATION_OFFLINE_PLAN');
  assert.equal(plan.project, 'pvbdiftvzoeelibxlxzb'); assert.equal(plan.username, 'admin');
  assert.equal(plan.requiredAuthVersion, 2); assert.equal(plan.requiredFirstLogin, false);
  assert.deepEqual(plan.checks, AUTH_VERIFICATION_CHECKS);
  assert.deepEqual(plan.potentialProductionWrites, ['api_login_rate_limits: failure/clear counters', 'api_rate_limit_windows: request counters']);
  assert.ok(plan.nextProductionRequirements.includes('NEW_COUNTER_WRITE_APPROVAL_CHECKSUM_AND_WINDOW'));
  assert.ok(plan.nextProductionRequirements.includes('PRIVATE_EXISTING_PASSWORD_CUSTODY_MATCHES_VERSION_TWO_SCRYPT_HASH'));
  for (const key of ['productionExecutionImplemented', 'productionExecutionApproved', 'oldApprovalReusable', 'passwordRotationAllowed',
    'durableProductionAttemptLatchImplemented', 'keychainAccessed', 'credentialFileRead', 'databaseAccessed', 'networkAccessed',
    'productionChanged', 'deploymentPerformed', 'readyForPublicLaunch']) assert.equal(plan[key], false);
});

test('fixture can start already rotated without a password RPC or mutation', async () => {
  const fixture = await createAuthAcceptanceFixture('rotated');
  const fingerprint = fixture.accountFingerprint(); await fixture.verifyRotatedCredentials();
  assert.equal(fixture.accountFingerprint(), fingerprint);
  assert.deepEqual(fixture.snapshot(), { version: 2, firstLogin: false, passwordChanges: 0, passwordRpcCalls: 0,
    blocked: 0, requests: 0, abortedRequests: 0, blockedStages: [] });
  await assert.rejects((await createAuthAcceptanceFixture()).verifyRotatedCredentials(), /FIXTURE_ROTATED_CREDENTIALS_REQUIRED/);
});

test('real Fastify/JWT/scrypt/SDK verification starts at version two and preserves account fingerprint', () => {
  const result = child([runner, 'rehearse']); assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'ISOLATED_POST_ROTATION_AUTH_VERIFICATION_PASSED'); assert.deepEqual(receipt.checks, AUTH_VERIFICATION_CHECKS);
  assert.deepEqual(receipt.isolatedOnlyChecks, ['SYNTHETIC_VERSION_ONE_SESSION_DENIED']);
  assert.equal(receipt.fixture.version, 2); assert.equal(receipt.fixture.firstLogin, false);
  assert.equal(receipt.fixture.passwordChanges, 0); assert.equal(receipt.fixture.passwordRpcCalls, 0);
  assert.equal(receipt.requests.rotationAttempts, 0); assert.equal(receipt.requests.rotationOutcome, 'not-attempted');
  assert.equal(receipt.requests.sent, receipt.fixture.requests); assert.equal(receipt.requests.blocked, 0);
  assert.ok(receipt.requests.writesAttempted > 0); // Counter writes, not a read-only login claim.
  for (const key of ['accountFingerprintUnchanged', 'realFastifyAuthRoutesTested', 'realPasswordHashAndJwtTested',
    'realSupabaseSdkAdaptersTested', 'restStoreEmulated']) assert.equal(receipt[key], true);
  for (const key of ['productionExecutionImplemented', 'durableProductionAttemptLatchImplemented', 'databaseAtomicityTested',
    'managedSupabaseIntegrationTested', 'productionLoginTested', 'productionPasswordChanged', 'previousProductionTokenTested',
    'logoutServerRevocationImplemented', 'uiBrowserFlowTested', 'keychainAccessed', 'credentialFileRead', 'databaseAccessed',
    'networkAccessed', 'workersStarted', 'productionChanged', 'devDatabaseChanged', 'deploymentPerformed', 'readyForPublicLaunch']) assert.equal(receipt[key], false);
  assert.doesNotMatch(result.stdout + result.stderr, /scrypt\$|Bearer |"temporaryPassword"|"newPassword"|"token"/);
});

test('verification transport cannot be bound to live, loopback, HTTP or non-origin URLs', () => {
  for (const origin of ['https://pvbdiftvzoeelibxlxzb.supabase.co', 'https://127.0.0.1', 'http://auth-acceptance.invalid',
    scope.origin + '/rest/v1', scope.origin + '?live=1', 'https://user:password@auth-acceptance.invalid']) {
    assert.throws(() => createIsolatedAuthVerificationTransport({ ...scope, origin }, async () => new Response('[]')));
  }
  assert.equal('armRotation' in transport(), false);
});

test('all password/reset/direct table mutations halt before any forwarding', async () => {
  let sent = 0;
  const forbidden = [rpc('change_password_atomic', { p_user_id: scope.userId, p_updated_by: scope.userId,
    p_expected_auth_version: 2, p_change_reason: 'Pengguna mengganti password akun', p_password_hash: 'scrypt$forbidden' }),
  rpc('reset_password_atomic', {}), rpc('create_user', {}), rpc('insert_activity_log', {})];
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) forbidden.push(new Request(scope.origin + '/rest/v1/users', {
    method, headers: { apikey: scope.key, 'content-type': 'application/json' }, body: '{}' }));
  for (const request of forbidden) {
    const t = transport(async () => { sent++; return new Response('[]'); });
    await assert.rejects(t.fetch(request)); await assert.rejects(t.fetch(read()));
    assert.equal(t.observations.sent, 0); assert.equal(t.observations.rotationAttempts, 0); assert.throws(t.assertHealthy);
  }
  assert.equal(sent, 0);
});

test('target, key, schema, own-account projection and counter principal barriers are retained', async () => {
  let sent = 0;
  for (const request of [new Request('https://example.com/rest/v1/users'), read(undefined, { apikey: 'wrong' }),
    read(undefined, { 'accept-profile': 'auth' }), read(undefined, { authorization: 'Bearer other' }),
    read('/rest/v1/users?select=*'), read('/rest/v1/users?select=id'), read('/rest/v1/users?select=id&id=eq.other'),
    read('/rest/v1/users?select=id&id=eq.' + scope.userId + '&select=password_hash'),
    read('/rest/v1/users?select=id&id=eq.' + scope.userId + '&or=(id.neq.other)'),
    read('/rest/v1/activity_logs?select=id'), rpc('clear_login_rate_limit', { p_rate_key: '0'.repeat(64) })]) {
    const t = transport(async () => { sent++; return new Response('[]'); }); await assert.rejects(t.fetch(request));
  }
  assert.equal(sent, 0);
});

test('counter quotas and bounded clear attempts fail closed without accepting password writes', async () => {
  const t = transport(async () => new Response(null, { status: 204 }));
  const key = t.counterKeys.login[0];
  for (let count = 0; count < 4; count++) await t.fetch(rpc('clear_login_rate_limit', { p_rate_key: key }));
  await assert.rejects(t.fetch(rpc('clear_login_rate_limit', { p_rate_key: key })), /AUTH_RATE_RPC_SCOPE_BARRIER/);
  assert.equal(t.observations.sent, 4); assert.equal(t.observations.writesAttempted, 4);
  const other = transport();
  await assert.rejects(other.fetch(rpc('consume_api_rate_limit_atomic', { p_rate_key: other.counterKeys.api[0],
    p_window_seconds: 60, p_max_requests: 9999 })), /AUTH_API_QUOTA_CONTRACT/);
  assert.equal(other.observations.sent, 0);
});

test('expired deadline or failed request precondition sends nothing', async () => {
  for (const extra of [{ deadline: Date.now() - 1 }, { beforeRequest() { throw new Error('Unprinted operator detail'); } }]) {
    let sent = 0;
    const t = createIsolatedAuthVerificationTransport({ ...scope, ...extra }, async () => { sent++; return new Response('[]'); });
    await assert.rejects(t.fetch(read())); assert.equal(sent, 0); assert.throws(t.assertHealthy);
  }
});

test('one-shot attempt latch and preflight failures stop before even anonymous counters', async () => {
  let requests = 0;
  const app = { inject() { requests++; throw new Error('Must not be requested'); } } as unknown as FastifyInstance;
  const once = createIsolatedVerificationAttempt(); await once();
  const d: AuthVerificationDependencies = { account: { userId: scope.userId, username: scope.username, nama: 'Guru Terisolasi', role: 'teacher' },
    currentPassword: 'SyntheticCurrentPassword2', previousPassword: 'SyntheticPreviousPassword1', transport: transport(),
    async preflight() {}, consumeAttempt: once, async verifyPostcondition() {} };
  await assert.rejects(runAuthVerificationFlow(app, d), /AUTH_VERIFICATION_ATTEMPT_ALREADY_CONSUMED/);
  let attempted = false;
  await assert.rejects(runAuthVerificationFlow(app, { ...d, async preflight() { throw new Error('Preflight failed'); },
    async consumeAttempt() { attempted = true; } }), /Preflight failed/);
  assert.equal(requests, 0); assert.equal(attempted, false);
});

test('SDK GET retry after upstream failure cannot forward a second request', async () => {
  let forwarded = 0;
  const t = transport(async () => { forwarded++; return new Response('{}', { status: 503 }); });
  const client = createClient(scope.origin, scope.key, { global: { fetch: t.fetch }, auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.from('users').select('id').eq('id', scope.userId).retry(true).abortSignal(AbortSignal.timeout(1200));
  assert.ok(result.error); assert.equal(forwarded, 1); assert.equal(t.observations.sent, 1);
  assert.ok(t.observations.blocked >= 2); assert.throws(t.assertHealthy);
});

test('lost counter acknowledgement is not replayed and error details are sanitized', async () => {
  let forwarded = 0;
  const t = transport(async () => { forwarded++; throw new Error('SyntheticSecretMustNotEscape'); });
  const request = rpc('clear_login_rate_limit', { p_rate_key: t.counterKeys.login[0] });
  await assert.rejects(t.fetch(request.clone()), /AUTH_REQUEST_FAILED_INSPECT_BEFORE_RETRY/);
  await assert.rejects(t.fetch(request.clone()), /AUTH_REQUEST_FAILED_INSPECT_BEFORE_RETRY/);
  assert.equal(forwarded, 1); assert.equal(t.observations.writesAttempted, 1); assert.equal(t.observations.rotationAttempts, 0);
});

test('real rehearsal rejects wrong version, first-login, inactive or substituted identity rows', () => {
  for (const overrides of [{ auth_version: 1 }, { is_first_login: true }, { is_active: false }, { id: 'other' }, { role: 'student' }]) {
    const result = fault(`const originalFetch = fixture.fetch;
      fixture.fetch = async (input, init) => {
        const request = new Request(input, init), response = await originalFetch(request);
        if (!new URL(request.url).pathname.endsWith('/users')) return response;
        const rows = await response.json();
        return new Response(JSON.stringify(rows.map(row => ({ ...row, ...${JSON.stringify(overrides)} }))), { headers: response.headers });
      };`);
    assert.equal(result.status, 0, result.stderr); const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'EXPECTED_STOP'); assert.equal(output.fixture.passwordRpcCalls, 0); assert.equal(output.fixture.passwordChanges, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /scrypt\$|Bearer |"token"/);
  }
});

test('legacy password upgrade through real auth route is blocked rather than silently mutating', () => {
  const result = fault(`const originalFetch = fixture.fetch;
    fixture.fetch = async (input, init) => {
      const request = new Request(input, init), response = await originalFetch(request);
      if (!new URL(request.url).searchParams.get('select')?.includes('password_hash')) return response;
      const rows = await response.json();
      return new Response(JSON.stringify(rows.map(row => ({ ...row, password_hash: fixture.newPassword }))), { headers: response.headers });
    };`);
  assert.equal(result.status, 0, result.stderr); const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'EXPECTED_STOP'); assert.equal(output.stage, 'AUTH_MUTATION_BARRIER');
  assert.equal(output.fixture.passwordChanges, 0); assert.equal(output.fixture.passwordRpcCalls, 0);
});

test('mismatched custody/preflight or changed account fingerprint cannot report acceptance', () => {
  for (const code of ["fixture.newPassword = 'SyntheticWrongCustodyPassword2';",
    "const originalFingerprint = fixture.accountFingerprint; fixture.accountFingerprint = () => fixture.snapshot().requests ? 'changed' : originalFingerprint();"]) {
    const result = fault(code); assert.equal(result.status, 0, result.stderr); const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'EXPECTED_STOP'); assert.equal(output.fixture.passwordChanges, 0); assert.equal(output.fixture.passwordRpcCalls, 0);
    if (code.startsWith('fixture.newPassword')) {
      assert.equal(output.stage, 'FIXTURE_ROTATED_CREDENTIALS_REQUIRED'); assert.equal(output.fixture.requests, 0);
    }
  }
});

test('isolated helper refuses cached runtime/client and exposes no production credential/worker entry point', async () => {
  const result = fault("require('./src/config/env.ts');");
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).stage, 'FRESH_ISOLATED_PROCESS_REQUIRED');
  const cached = fault("require.cache[require.resolve('./src/config/env.ts')] = { exports: {} };");
  assert.equal(cached.status, 0, cached.stderr); assert.equal(JSON.parse(cached.stdout).stage, 'FRESH_ISOLATED_PROCESS_REQUIRED');
  const source = await readFile(runner, 'utf8');
  assert.doesNotMatch(source, /readKeychain\(|readFile\(|\.listen\(|\.startWorkers\(|execFile\(|spawn\(/);
  assert.match(source, /globalThis.fetch = transport.fetch/);
  const flow = await readFile(resolve(__dirname, 'authVerificationFlow.ts'), 'utf8');
  assert.doesNotMatch(flow, /\/api\/auth\/(?:change-password|reset)|armRotation\(/);
});
