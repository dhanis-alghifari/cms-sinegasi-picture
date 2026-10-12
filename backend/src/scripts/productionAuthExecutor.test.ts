import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, link, lstat, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { AUTH_ACCOUNT, AUTH_PRIVATE_ROOT, AUTH_EXECUTOR_GUARD_CHECKS, MANAGED_AUTH_CHECKS, parseAuthExecutorCommand,
  validateAuthApproval, validateAuthEvidence, validateAuthSupportingEvidence } from './productionAuthExecutorCore.js';
import { syntheticAuthReview } from './productionAuthExecutorRehearsal.js';
import { sha256 } from './productionReconciliation.js';
import { createIsolatedAuthTransport } from './productionAuthTransport.js';
import { persistAuthCustody } from './productionAuthCustody.js';
import { requireAuthAccountState, requireRotatedPassword, verifyAuthAuditRows } from './productionAuthBaseline.js';
import { hashPassword } from '../services/passwordService.js';
import { authExecutorFailure } from './productionAuthExecutor.js';

const backend = resolve(__dirname, '../..');
function cli(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', resolve(__dirname, 'productionAuthExecutor.ts'), ...args], {
    cwd: backend, encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, ENV_FILE_LOADING: 'disabled', ...extraEnv },
  });
}
function approval(changes: Record<string, unknown> = {}, now?: number) {
  const review = syntheticAuthReview(), raw = JSON.stringify({ ...review.approval, ...changes });
  return validateAuthApproval(raw, sha256(raw), review.bindings, now ?? review.now);
}
function evidenceReview() {
  const review = syntheticAuthReview();
  const a = approval();
  return { ...review, a };
}
const scope = { origin: 'https://executor-tests.invalid', key: 'sb_secret_synthetic_transport_only',
  userId: '11111111-1111-4111-8111-111111111111', username: 'fixture_guru', newPassword: 'SyntheticPasswordForGuard123',
  deadline: Date.now() + 60_000, beforeRequest() {} };
function transport(upstream: typeof fetch = async () => new Response('[]')) {
  return createIsolatedAuthTransport({ ...scope, deadline: Date.now() + 60_000 }, upstream);
}
function readRequest(path = '/rest/v1/users?select=id&id=eq.' + scope.userId, headers: Record<string, string> = {}) {
  return new Request(scope.origin + path, { headers: { apikey: scope.key, ...headers } });
}
async function passwordRequest(changes: Record<string, unknown> = {}) {
  return new Request(scope.origin + '/rest/v1/rpc/change_password_atomic', { method: 'POST', headers: { apikey: scope.key, 'content-type': 'application/json' },
    body: JSON.stringify({ p_user_id: scope.userId, p_updated_by: scope.userId, p_expected_auth_version: 1,
      p_change_reason: 'Pengguna mengganti password akun', p_password_hash: await hashPassword(scope.newPassword), ...changes }) });
}

test('executor parser requires explicit readiness; rejects URLs, passwords, old approvals and extra flags', () => {
  assert.deepEqual(parseAuthExecutorCommand(['plan']), { mode: 'plan' });
  assert.deepEqual(parseAuthExecutorCommand(['rehearse']), { mode: 'rehearse' });
  assert.deepEqual(parseAuthExecutorCommand(['inspect', '--keychain-ready']), { mode: 'inspect' });
  const args = ['apply', '--approval', AUTH_PRIVATE_ROOT + '/approval.auth.2026.json', '--confirm-approval', 'a'.repeat(64),
    '--keychain-ready', '--password-custody-ready'];
  assert.equal(parseAuthExecutorCommand(args).mode, 'apply');
  for (const rejected of [[], ['apply'], ['inspect'], args.slice(0, 6), [...args, '--force'], ['plan', '--password', 'ignored'],
    ['rehearse', '--url', 'https://example.com'], ['apply', '--approval', '/tmp/old-bootstrap.json', ...args.slice(3)]]) {
    assert.throws(() => parseAuthExecutorCommand(rejected));
  }
});
test('CLI denies invalid arguments/env/TLS before secrets or managed runtime', () => {
  for (const [args, env] of [[['apply'], {}], [['inspect'], {}], [['rehearse'], { ENV_FILE_LOADING: 'enabled' }],
    [['plan'], { NODE_TLS_REJECT_UNAUTHORIZED: '0' }]] as Array<[string[], Record<string, string>]>) {
    const result = cli(args, env); assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).productionChanged, false);
  }
});
test('offline executor plan exposes future gates but performs no managed operation', () => {
  const result = cli(['plan']); assert.equal(result.status, 0, result.stderr); const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, 'PRODUCTION_AUTH_EXECUTOR_OFFLINE_PLAN'); assert.equal(plan.productionExecutionImplemented, true);
  assert.equal(plan.productionExecutionApproved, false); assert.equal(plan.role, 'teacher');
  for (const key of ['keychainAccessed', 'credentialFileRead', 'databaseAccessed', 'networkAccessed', 'productionChanged', 'deploymentPerformed']) assert.equal(plan[key], false);
});
test('exact executor runs actual Fastify flow against fixture with one rotation and no network', () => {
  const result = cli(['rehearse']); assert.equal(result.status, 0, result.stderr); const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'ISOLATED_AUTH_EXECUTOR_PASSED'); assert.deepEqual(receipt.checks, MANAGED_AUTH_CHECKS);
  for (const key of AUTH_EXECUTOR_GUARD_CHECKS) assert.equal(receipt.guardChecks[key], true);
  assert.equal(receipt.fixture.passwordChanges, 1); assert.equal(receipt.fixture.passwordRpcCalls, 1);
  assert.equal(receipt.requests.rotationAttempts, 1); assert.equal(receipt.requests.blocked, 0);
  assert.equal(receipt.restStoreEmulated, true);
  for (const key of ['keychainAccessed', 'credentialFileRead', 'networkAccessed', 'productionLoginTested', 'productionPasswordChanged',
    'productionChanged', 'deploymentPerformed', 'databaseAtomicityTested', 'managedSupabaseIntegrationTested']) assert.equal(receipt[key], false);
  assert.doesNotMatch(result.stdout + result.stderr, /scrypt\$|Bearer |"temporaryPassword"|"newPassword"|"token"/);
});
test('new operation, exact release/source/account and all explicit risk acknowledgements are mandatory', () => {
  assert.equal(approval().userId, AUTH_ACCOUNT.userId);
  for (const changes of [{ operation: 'bootstrap_first_teacher' }, { operation: 'migration' }, { approved: false },
    { project: 'other' }, { userId: scope.userId }, { username: 'other' }, { nama: 'Other' }, { role: 'admin' },
    { releaseSha: '0'.repeat(40) }, { runnerSourceSha256: '0'.repeat(64) }, { packageSha256: '0'.repeat(64) },
    { isolatedFixture: true }, { qualityRunId: 0 }, { reviewedBy: '\noperator' }]) assert.throws(() => approval(changes));
  for (const key of ['noDeploymentAuthorized', 'maintenanceWindowConfirmed', 'macOnlyKeyRiskAcknowledged',
    'sharedVpsRecoveryRiskAcknowledged', 'oneRotationOnlyAcknowledged', 'counterAndAuditWritesAcknowledged',
    'privatePasswordCustodyAcknowledged', 'noAutomaticRetryAcknowledged']) assert.throws(() => approval({ [key]: false }));
});
test('wrong checksum and expired/future/oversized window or stale/future backup fail closed', () => {
  const r = syntheticAuthReview(), raw = JSON.stringify(r.approval);
  assert.throws(() => validateAuthApproval(raw, '0'.repeat(64), r.bindings, r.now), /CHECKSUM/);
  for (const changes of [{ backupId: '2026-10-12T01-52-44-292Z' }, { backupId: '2026-10-12T05-00-00-000Z' },
    { windowStart: '2026-10-12T04:40:00Z' }, { windowEnd: '2026-10-12T04:00:00Z' }, { windowEnd: '2026-10-12T06:00:00Z' }]) {
    assert.throws(() => approval(changes));
  }
  assert.throws(() => approval({}, Date.parse(r.approval.windowEnd)));
});
test('evidence rejects hashes, old backup, dirty/wrong-source receipt and omitted guard checks', () => {
  const r = evidenceReview(); validateAuthSupportingEvidence(r.a, r.evidence, r.now);
  assert.throws(() => validateAuthEvidence(r.a, r.evidence, r.now)); // synthetic receipt is not the pinned real receipt
  for (const key of ['baseline', 'recovery', 'rehearsal'] as const) assert.throws(() => validateAuthSupportingEvidence(r.a, { ...r.evidence, [key]: '{}' }, r.now));
  const original = JSON.parse(r.evidence.rehearsal);
  for (const changes of [{ workingTreeDirty: true }, { runnerSourceSha256: '0'.repeat(64) }, { guardChecks: {} },
    { networkAccessed: true }, { checks: [] }]) {
    const rehearsal = JSON.stringify({ ...original, ...changes });
    assert.throws(() => validateAuthSupportingEvidence({ ...r.a, rehearsalEvidenceSha256: sha256(rehearsal) }, { ...r.evidence, rehearsal }, r.now));
  }
  const baseline = JSON.stringify({ ...JSON.parse(r.evidence.baseline), observedAt: '2026-10-12T03:00:00Z' });
  assert.throws(() => validateAuthSupportingEvidence({ ...r.a, baselineEvidenceSha256: sha256(baseline) }, { ...r.evidence, baseline }, r.now));
});
test('private evidence paths cannot escape the fixed directory', () => {
  for (const key of ['recoveryEvidenceFile', 'baselineEvidenceFile', 'rehearsalEvidenceFile']) {
    assert.throws(() => approval({ [key]: '../secret.json' })); assert.throws(() => approval({ [key]: '/tmp/secret.json' }));
  }
});
test('transport rejects target/key/schema/unscoped projections before forwarding', async () => {
  let sent = 0;
  for (const request of [new Request('https://example.com/rest/v1/users'), readRequest(undefined, { apikey: 'wrong' }),
    readRequest(undefined, { 'accept-profile': 'auth' }), readRequest(undefined, { authorization: 'Bearer different' }),
    readRequest('/rest/v1/users?select=*'), readRequest('/rest/v1/users?select=id'), readRequest('/rest/v1/users?select=id&id=eq.other'),
    readRequest('/rest/v1/users?select=id&id=eq.' + scope.userId + '&or=(id.neq.other)'), readRequest('/storage/v1/object/x')]) {
    const t = transport(async () => { sent++; return new Response('[]'); }); await assert.rejects(t.fetch(request));
  }
  assert.equal(sent, 0);
  assert.throws(() => createIsolatedAuthTransport({ ...scope, origin: 'https://pvbdiftvzoeelibxlxzb.supabase.co' }, fetch));
});
test('direct table writes, arbitrary RPCs and out-of-scope counter keys are denied', async () => {
  for (const request of [new Request(scope.origin + '/rest/v1/users', { method: 'PATCH', headers: { apikey: scope.key } }),
    new Request(scope.origin + '/rest/v1/rpc/reset_password_atomic', { method: 'POST', headers: { apikey: scope.key, 'content-type': 'application/json' }, body: '{}' }),
    new Request(scope.origin + '/rest/v1/rpc/clear_login_rate_limit', { method: 'POST', headers: { apikey: scope.key, 'content-type': 'application/json' },
      body: JSON.stringify({ p_rate_key: '0'.repeat(64) }) })]) await assert.rejects(transport().fetch(request));
});
test('password RPC is unarmed by default and refuses actor/version/password substitution', async () => {
  await assert.rejects(transport().fetch(await passwordRequest()), /ROTATION/);
  for (const changes of [{ p_updated_by: 'other' }, { p_user_id: 'other' }, { p_expected_auth_version: 2 },
    { p_change_reason: 'other' }, { p_password_hash: await hashPassword('OtherSyntheticPassword123') }]) {
    const t = transport(); t.armRotation(); await assert.rejects(t.fetch(await passwordRequest(changes)), /ROTATION/);
    assert.equal(t.observations.rotationAttempts, 0);
  }
});
test('one acknowledged password RPC can never be replayed or rearmed', async () => {
  let sent = 0;
  const t = transport(async () => { sent++; return Response.json({ id: scope.userId, is_first_login: false, is_active: true, auth_version: 2 }); });
  t.armRotation(); const request = await passwordRequest(); await t.fetch(request.clone());
  assert.equal(t.observations.rotationOutcome, 'acknowledged'); assert.throws(() => t.armRotation());
  await assert.rejects(t.fetch(request.clone())); assert.equal(sent, 1);
});
test('lost/malformed password acknowledgements report unknown and never retry', async () => {
  for (const upstream of [async () => { throw new Error('synthetic lost response'); }, async () => Response.json({ id: 'wrong' }),
    async () => new Response('{}', { status: 503 })]) {
    let sent = 0; const t = transport(async () => { sent++; return upstream(); }); t.armRotation(); const req = await passwordRequest();
    await assert.rejects(t.fetch(req.clone())); await assert.rejects(t.fetch(req.clone()));
    assert.equal(sent, 1); assert.equal(t.observations.rotationAttempts, 1); assert.equal(t.observations.rotationOutcome, 'unknown');
  }
});
test('redirects, oversized body, expired deadline and cancellation halt forwarding', async () => {
  for (const upstream of [async () => new Response(null, { status: 302, headers: { location: 'https://example.com' } }),
    async () => new Response('x'.repeat(256 * 1024 + 1))]) await assert.rejects(transport(upstream).fetch(readRequest()));
  const t = createIsolatedAuthTransport({ ...scope, deadline: Date.now() - 1 }, async () => { throw new Error('should not forward'); });
  await assert.rejects(t.fetch(readRequest()), /DEADLINE/); assert.equal(t.observations.sent, 0);
});
test('transport deadline bounds even an upstream/body that ignores AbortSignal', async () => {
  for (const upstream of [async () => new Promise<Response>(() => {}), async () => new Response(new ReadableStream({ start() {} }))]) {
    const t = createIsolatedAuthTransport({ ...scope, deadline: Date.now() + 40 }, upstream);
    // An explicit timer keeps the test process alive; production has sockets/app handles.
    const alive = setTimeout(() => {}, 200);
    try { await assert.rejects(t.fetch(readRequest()), /DEADLINE/); } finally { clearTimeout(alive); }
  }
});
test('read request budget is bounded and all post-failure requests are refused', async () => {
  const t = transport(); for (let i = 0; i < 150; i++) await t.fetch(readRequest());
  await assert.rejects(t.fetch(readRequest()), /BUDGET/); assert.equal(t.observations.sent, 150);
});
test('private custody fsyncs a 0600 exclusive file; second attempt cannot overwrite', async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'auth-custody-test.')), file = join(directory, 'attempt.json');
  try {
    await persistAuthCustody(file, { newPassword: 'synthetic-private-file-not-live' });
    assert.equal((await lstat(file)).mode & 0o777, 0o600); assert.equal((await lstat(directory)).mode & 0o777, 0o700);
    const first = await readFile(file, 'utf8'); await assert.rejects(persistAuthCustody(file, { newPassword: 'replacement' }));
    assert.equal(await readFile(file, 'utf8'), first);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('custody refuses symlink/unsafe directory and preserves existing linked files', async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'auth-custody-test.')), file = join(directory, 'attempt.json');
  try {
    await chmod(directory, 0o755); await assert.rejects(persistAuthCustody(file, {})); await chmod(directory, 0o700);
    await symlink(directory + '/missing.json', file); await assert.rejects(persistAuthCustody(file, {}));
    assert.equal((await lstat(file)).isSymbolicLink(), true);
    const real = directory + '/original.json'; await persistAuthCustody(real, { synthetic: true });
    await link(real, directory + '/linked.json'); await assert.rejects(persistAuthCustody(directory + '/linked.json', {}));
    assert.equal(await readFile(real, 'utf8'), '{\n  "synthetic": true\n}\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('fixed account baseline rejects changed role/id/first-login/version/hash', () => {
  const user = { id: AUTH_ACCOUNT.userId, username: AUTH_ACCOUNT.username, nama: AUTH_ACCOUNT.nama, role: 'teacher',
    is_active: true, is_first_login: true, auth_version: 1, password_hash: 'scrypt$synthetic-state' };
  assert.equal(requireAuthAccountState(user, false), user);
  for (const changes of [{ id: scope.userId }, { role: 'admin' }, { is_first_login: false }, { auth_version: 2 },
    { password_hash: 'legacy-hash' }, { is_active: false }]) assert.throws(() => requireAuthAccountState({ ...user, ...changes }, false));
});
function auditRows() {
  const common = { user_id: AUTH_ACCOUNT.userId, record_id: AUTH_ACCOUNT.userId, table_name: 'users' };
  const boot = { ...common, source: 'bootstrap', action: 'INSERT', old_values: null, new_values: {
    id: AUTH_ACCOUNT.userId, username: AUTH_ACCOUNT.username, nama: AUTH_ACCOUNT.nama, role: 'teacher', is_first_login: true, is_active: true, auth_version: 1 } };
  return [boot, { ...common, source: 'api', action: 'UPDATE', old_values: { auth_version: 1 }, new_values: { operation: 'change_password', auth_version: 2 } },
    { ...common, source: 'trigger', action: 'UPDATE', old_values: { auth_version: 1, password_hash: '[REDACTED]' },
      new_values: { auth_version: 2, password_hash: '[REDACTED]' } }];
}
test('postcondition expects bootstrap + trigger + RPC audit, not a false single-audit assumption', () => {
  const rows = auditRows(); verifyAuthAuditRows(rows.slice(0, 1), false); verifyAuthAuditRows(rows, true);
  assert.throws(() => verifyAuthAuditRows(rows.slice(0, 2), true)); assert.throws(() => verifyAuthAuditRows([...rows, rows[2]], true));
  assert.throws(() => verifyAuthAuditRows([{ ...rows[0], user_id: scope.userId }, ...rows.slice(1)], true));
});
test('audit payloads cannot contain real credential hashes/tokens', () => {
  const rows = auditRows(); assert.throws(() => verifyAuthAuditRows([rows[0], rows[1], { ...rows[2], new_values: { auth_version: 2, password_hash: 'scrypt$secret' } }], true));
  assert.throws(() => verifyAuthAuditRows([{ ...rows[0], metadata: { nested: { token: 'synthetic-exposed-token' } } }, ...rows.slice(1)], true));
});
test('database password postcondition verifies both new-password match and temporary-password denial', async () => {
  const current = 'SyntheticCurrent123', previous = 'SyntheticPrevious123';
  const user = { id: AUTH_ACCOUNT.userId, username: AUTH_ACCOUNT.username, nama: AUTH_ACCOUNT.nama, role: 'teacher',
    is_active: true, is_first_login: false, auth_version: 2, password_hash: await hashPassword(current) };
  await requireRotatedPassword(user, previous, current); await assert.rejects(requireRotatedPassword(user, current, current));
});
test('failure reporting never prints raw provider errors, passwords or tokens', () => {
  const receipt = authExecutorFailure(new Error('secret provider data'));
  assert.equal(receipt.stage, 'AUTH_EXECUTOR_STOPPED'); assert.equal(receipt.automaticRetryAllowed, false);
  assert.doesNotMatch(JSON.stringify(receipt), /secret provider data/);
});
