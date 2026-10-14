import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, lstat, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../services/passwordService.js';
import { AUTH_ACCOUNT, AUTH_CUSTODY_FILE, AUTH_PRIVATE_ROOT, AUTH_TEMPORARY_FILE, authRecord } from './productionAuthExecutorCore.js';
import { AUTH_VERIFICATION_CHECKS } from './authVerificationFlow.js';
import { persistAuthCustody } from './productionAuthCustody.js';
import { createIsolatedAuthVerificationTransport, createManagedAuthVerificationTransport } from './productionAuthTransport.js';
import { INTEGRATION_ORIGIN } from './productionManagedIntegrationCore.js';
import { AUTH_ROTATION_APPROVAL_SHA, AUTH_VERIFICATION_ATTEMPT_FILE, AUTH_VERIFICATION_GUARDS,
  parseVerificationCommand, readVerificationCredentialDocuments, requireVerificationCredentialMatch, requireVerificationUnchanged,
  validateVerificationApproval, validateVerificationEvidence, validateVerificationSupportingEvidence } from './productionAuthVerificationCore.js';
import { persistVerificationAttempt, requireNoVerificationAttempt } from './productionAuthVerificationAttempt.js';
import { syntheticVerificationReview } from './productionAuthVerificationExecutorRehearsal.js';
import { verificationExecutorFailure } from './productionAuthVerificationExecutor.js';
import { sha256 } from './productionReconciliation.js';

const backend = resolve(__dirname, '../..'), runner = resolve(__dirname, 'productionAuthVerificationExecutor.ts');
function cli(args: readonly string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', runner, ...args], { cwd: backend, encoding: 'utf8', timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024, env: { PATH: process.env.PATH, ENV_FILE_LOADING: 'disabled', TZ: 'UTC', ...extraEnv } });
}
function approval(changes: Record<string, unknown> = {}, now?: number) {
  const r = syntheticVerificationReview(), raw = JSON.stringify({ ...r.approval, ...changes });
  return validateVerificationApproval(raw, sha256(raw), r.bindings, now ?? r.now);
}
function documents(custodyChanges: Record<string, unknown> = {}, temporaryChanges: Record<string, unknown> = {}) {
  const r = syntheticVerificationReview();
  const custody = { format: 1, operation: 'first_teacher_auth_acceptance', project: 'pvbdiftvzoeelibxlxzb', ...AUTH_ACCOUNT,
    ...r.bindings, approvalSha256: AUTH_ROTATION_APPROVAL_SHA, automaticRetryAllowed: false, createdAt: '2026-10-12T10:42:00.000Z',
    executionState: 'prepared-outcome-must-be-inspected', newPassword: 'SyntheticExistingNewPassword2', ...custodyChanges };
  const temporary = { version: 1, projectRef: 'pvbdiftvzoeelibxlxzb', ...AUTH_ACCOUNT, isFirstLogin: true,
    temporaryPassword: 'SyntheticOriginalTemporaryPassword1', ...temporaryChanges };
  return { custodyRaw: JSON.stringify(custody), temporaryRaw: JSON.stringify(temporary) };
}

test('verification parser requires its own approval stem and both readiness flags, never old apply/reset shortcuts', () => {
  const args = ['apply', '--approval', AUTH_PRIVATE_ROOT + '/approval.auth-verification.2026.json', '--confirm-approval', 'a'.repeat(64),
    '--keychain-ready', '--password-custody-ready'];
  assert.equal(parseVerificationCommand(args).mode, 'apply');
  assert.equal(parseVerificationCommand(['inspect', '--keychain-ready', '--password-custody-ready']).mode, 'inspect');
  for (const rejected of [[], ['apply'], ['reset'], ['resume'], ['inspect'], ['inspect', '--keychain-ready'], args.slice(0, 6),
    [...args, '--force'], ['plan', '--password', 'untrusted'], ['rehearse', '--url', INTEGRATION_ORIGIN],
    ['apply', '--approval', AUTH_PRIVATE_ROOT + '/approval.auth.2026.json', ...args.slice(3)],
    ['apply', '--approval', '/tmp/approval.auth-verification.2026.json', ...args.slice(3)]]) assert.throws(() => parseVerificationCommand(rejected));
});
test('invalid CLI/env/TLS stops before any private file, Keychain or runtime access', () => {
  for (const [args, env] of [[['apply'], {}], [['inspect', '--keychain-ready'], {}], [['plan'], { ENV_FILE_LOADING: 'enabled' }],
    [['rehearse'], { NODE_TLS_REJECT_UNAUTHORIZED: '0' }]] as Array<[string[], Record<string, string>]>) {
    const result = cli(args, env); assert.equal(result.status, 1); assert.equal(result.stdout, '');
    const failure = JSON.parse(result.stderr); assert.equal(failure.productionChanged, false); assert.equal(failure.productionPasswordChanged, false);
    assert.equal(failure.verificationAttemptPreserved, false); assert.equal(failure.automaticRetryAllowed, false);
  }
});
test('new executor plan is local metadata only, discloses counter scope and fixed separate attempt', () => {
  const result = cli(['plan']); assert.equal(result.status, 0, result.stderr); const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, 'PRODUCTION_AUTH_VERIFICATION_EXECUTOR_OFFLINE_PLAN'); assert.equal(plan.productionExecutionImplemented, true);
  assert.equal(plan.productionExecutionApproved, false); assert.equal(plan.passwordMutationAllowed, false);
  assert.equal(plan.requiredAuthVersion, 2); assert.equal(plan.requiredFirstLogin, false);
  assert.equal(plan.verificationAttemptFile, AUTH_VERIFICATION_ATTEMPT_FILE); assert.deepEqual(plan.managedChecks, AUTH_VERIFICATION_CHECKS);
  assert.equal(plan.existingCredentialFiles.includes(AUTH_CUSTODY_FILE), true); assert.equal(plan.existingCredentialFiles.includes(AUTH_TEMPORARY_FILE), true);
  assert.match(plan.runnerSourceSha256, /^[a-f0-9]{64}$/);
  for (const key of ['oldApprovalReusable', 'keychainAccessed', 'credentialFileRead', 'databaseAccessed', 'networkAccessed',
    'productionLoginTested', 'productionPasswordChanged', 'productionChanged', 'deploymentPerformed', 'readyForPublicLaunch']) assert.equal(plan[key], false);
});
test('exact executor rehearsal proves nine actual-route checks, eight guards and zero password mutation', () => {
  const result = cli(['rehearse']); assert.equal(result.status, 0, result.stderr); const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'ISOLATED_AUTH_VERIFICATION_EXECUTOR_PASSED'); assert.deepEqual(receipt.checks, AUTH_VERIFICATION_CHECKS);
  for (const key of AUTH_VERIFICATION_GUARDS) assert.equal(receipt.guardChecks[key], true);
  assert.equal(receipt.fixture.version, 2); assert.equal(receipt.fixture.firstLogin, false);
  assert.equal(receipt.fixture.passwordChanges, 0); assert.equal(receipt.fixture.passwordRpcCalls, 0);
  assert.equal(receipt.requests.rotationAttempts, 0); assert.equal(receipt.requests.rotationOutcome, 'not-attempted');
  assert.equal(receipt.requests.blocked, 0); assert.equal(receipt.fixture.blocked, 0); assert.equal(receipt.fixture.requests, receipt.requests.sent);
  assert.ok(receipt.requests.writesAttempted > 0); assert.equal(receipt.accountFingerprintUnchanged, true); assert.equal(receipt.isolatedDurableAttemptTested, true);
  assert.equal(receipt.cleanupVerified, true);
  for (const key of ['keychainAccessed', 'credentialFileRead', 'databaseAccessed', 'networkAccessed', 'productionLoginTested',
    'productionPasswordChanged', 'productionChanged', 'deploymentPerformed', 'databaseAtomicityTested', 'managedSupabaseIntegrationTested',
    'previousProductionTokenTested', 'uiBrowserFlowTested', 'workersStarted', 'readyForPublicLaunch']) assert.equal(receipt[key], false);
  assert.doesNotMatch(result.stdout + result.stderr, /scrypt\$|Bearer |"newPassword"|"temporaryPassword"|"token"/);
});
test('approval fixes account/version/operation/source and rejects hidden secret, URL or extra scope fields', () => {
  assert.equal(approval().userId, AUTH_ACCOUNT.userId);
  for (const changes of [{ operation: 'first_teacher_auth_acceptance' }, { operation: 'bootstrap_first_teacher' }, { approved: false },
    { project: 'other' }, { userId: 'other' }, { username: 'other' }, { nama: 'other' }, { role: 'admin' }, { requiredAuthVersion: 1 },
    { requiredFirstLogin: true }, { rotationApprovalSha256: '0'.repeat(64) }, { releaseSha: '0'.repeat(40) },
    { runnerSourceSha256: '0'.repeat(64) }, { packageSha256: '0'.repeat(64) }, { isolatedFixture: true },
    { password: 'must never enter approval' }, { url: INTEGRATION_ORIGIN }, { counterWritesOnlyAcknowledged: false }]) assert.throws(() => approval(changes));
});
test('all no-mutation, no-retry, custody, maintenance and recovery risk acknowledgements are mandatory', () => {
  for (const key of ['macOnlyKeyRiskAcknowledged', 'sharedVpsRecoveryRiskAcknowledged', 'maintenanceWindowConfirmed',
    'counterWritesOnlyAcknowledged', 'noPasswordMutationAcknowledged', 'existingPasswordCustodyAcknowledged',
    'durableSeparateAttemptAcknowledged', 'noAutomaticRetryAcknowledged', 'noDeploymentAuthorized']) assert.throws(() => approval({ [key]: false }));
  for (const changes of [{ qualityRunId: 0 }, { reviewedBy: '\noperator' }, { windowEnd: 'invalid' },
    { passwordCustodySha256: 'invalid' }, { temporaryCredentialSha256: 'invalid' }]) assert.throws(() => approval(changes));
});
test('checksums, post-rotation fresh backup and new bounded window are enforced', () => {
  const r = syntheticVerificationReview(), raw = JSON.stringify(r.approval);
  assert.throws(() => validateVerificationApproval(raw, AUTH_ROTATION_APPROVAL_SHA, r.bindings, r.now));
  assert.throws(() => approval({}, Date.parse(r.approval.windowEnd)));
  for (const changes of [{ backupId: '2026-10-12T09-45-03-762Z' }, { backupId: '2026-10-13T00-00-00-000Z' },
    { backupId: '2026-10-13T04-00-00-000Z' }, { windowStart: '2026-10-13T03:40:00.000Z' },
    { windowEnd: '2026-10-13T05:00:00.000Z' }, { windowEnd: '2026-10-13T03:10:00.000Z' }]) assert.throws(() => approval(changes));
});
test('only new private baseline/rehearsal/recovery filenames are permitted', () => {
  for (const key of ['recoveryEvidenceFile', 'baselineEvidenceFile', 'rehearsalEvidenceFile']) {
    assert.throws(() => approval({ [key]: '../secret.json' })); assert.throws(() => approval({ [key]: '/tmp/secret.json' }));
  }
  assert.throws(() => approval({ baselineEvidenceFile: 'production-auth.baseline.2026.json' }));
  assert.throws(() => approval({ rehearsalEvidenceFile: 'production-auth.executor-rehearsal.2026.json' }));
});
test('supporting evidence passes only with a new version-two baseline and exact clean executor receipt', () => {
  const r = syntheticVerificationReview(), a = approval();
  validateVerificationSupportingEvidence(a, r.evidence, r.now);
  assert.throws(() => validateVerificationEvidence(a, r.evidence, r.now)); // Original bootstrap pin cannot be substituted.
  for (const key of ['recovery', 'baseline', 'rehearsal'] as const) assert.throws(() => validateVerificationSupportingEvidence(a, { ...r.evidence, [key]: '{}' }, r.now));
  for (const changes of [{ status: 'PRODUCTION_AUTH_ROTATION_OBSERVED' }, { passwordCustodyHashMatch: false }, { requiredAuthVersion: 1 },
    { verificationAttemptExists: true }, { passwordCustodySha256: '0'.repeat(64) }, { workingTreeDirty: true },
    { observedAt: '2026-10-13T02:59:00.000Z' }, { observedAt: '2026-10-13T03:40:00.000Z' }]) {
    const baseline = JSON.stringify({ ...authRecord(JSON.parse(r.evidence.baseline)), ...changes });
    assert.throws(() => validateVerificationSupportingEvidence({ ...a, baselineEvidenceSha256: sha256(baseline) }, { ...r.evidence, baseline }, r.now));
  }
});
test('rehearsal receipts cannot hide password writes, wrong guards, live access or dirty/wrong source', () => {
  const r = syntheticVerificationReview(), a = approval();
  for (const changes of [{ status: 'ISOLATED_AUTH_EXECUTOR_PASSED' }, { guardChecks: {} }, { checks: [] }, { networkAccessed: true },
    { credentialFileRead: true }, { workingTreeDirty: true }, { cleanupVerified: false }, { isolatedDurableAttemptTested: false },
    { runnerSourceSha256: '0'.repeat(64) },
    { fixture: { version: 2, firstLogin: false, passwordChanges: 1, passwordRpcCalls: 1 } },
    { requests: { rotationAttempts: 1, rotationOutcome: 'acknowledged', blocked: 0 } }]) {
    const rehearsal = JSON.stringify({ ...authRecord(JSON.parse(r.evidence.rehearsal)), ...changes });
    assert.throws(() => validateVerificationSupportingEvidence({ ...a, rehearsalEvidenceSha256: sha256(rehearsal) }, { ...r.evidence, rehearsal }, r.now));
  }
});
test('recovery evidence cannot bypass restore/ciphertext parity or invent an independent recovery key', () => {
  const r = syntheticVerificationReview(), a = approval();
  for (const changes of [{ restore: {} }, { copy: {} }, { independentKeyRecovery: { verified: true } }, { receipt: {} }]) {
    const recovery = JSON.stringify({ ...authRecord(JSON.parse(r.evidence.recovery)), ...changes });
    assert.throws(() => validateVerificationSupportingEvidence({ ...a, recoveryEvidenceSha256: sha256(recovery) }, { ...r.evidence, recovery }, r.now));
  }
  assert.throws(() => validateVerificationSupportingEvidence({ ...a, macOnlyKeyRiskAcknowledged: false } as unknown as typeof a, r.evidence, r.now));
});
test('existing credential documents require original account/provenance and never create replacements', () => {
  const original = documents(), credentials = readVerificationCredentialDocuments(original.custodyRaw, original.temporaryRaw);
  assert.equal(credentials.currentPassword, 'SyntheticExistingNewPassword2'); assert.equal(credentials.previousPassword, 'SyntheticOriginalTemporaryPassword1');
  assert.equal(credentials.passwordCustodySha256, sha256(original.custodyRaw)); assert.equal(credentials.temporaryCredentialSha256, sha256(original.temporaryRaw));
  for (const changes of [{ newPassword: '' }, { newPassword: 'x'.repeat(129) }, { newPassword: credentials.previousPassword },
    { operation: 'bootstrap_first_teacher' }, { userId: 'other' }, { role: 'admin' }, { automaticRetryAllowed: true },
    { approvalSha256: '0'.repeat(64) }, { executionState: 'overwritten' }, { createdAt: '2026-10-13T00:00:00Z' }]) {
    const d = documents(changes); assert.throws(() => readVerificationCredentialDocuments(d.custodyRaw, d.temporaryRaw));
  }
  for (const changes of [{ isFirstLogin: false }, { temporaryPassword: '' }, { username: 'other' }, { projectRef: 'other' }]) {
    const d = documents({}, changes); assert.throws(() => readVerificationCredentialDocuments(d.custodyRaw, d.temporaryRaw));
  }
});
test('credential preflight proves current hash match/old denial, rejects legacy or drift before any login', async () => {
  const d = documents(), credentials = readVerificationCredentialDocuments(d.custodyRaw, d.temporaryRaw);
  const user = { id: AUTH_ACCOUNT.userId, username: AUTH_ACCOUNT.username, nama: AUTH_ACCOUNT.nama, role: 'teacher',
    is_active: true, is_first_login: false, auth_version: 2, password_hash: await hashPassword(credentials.currentPassword) };
  await requireVerificationCredentialMatch(user, credentials);
  for (const changed of [{ ...user, auth_version: 1 }, { ...user, is_first_login: true }, { ...user, is_active: false },
    { ...user, password_hash: credentials.currentPassword }, { ...user, password_hash: await hashPassword(credentials.previousPassword) }]) {
    await assert.rejects(requireVerificationCredentialMatch(changed, credentials));
  }
  await assert.rejects(requireVerificationCredentialMatch(user, { ...credentials, currentPassword: 'WrongSyntheticCustodyPassword2' }));
});
test('postcondition allows only counter inventory changes, never account/audit/migration/extension changes', () => {
  const before = syntheticVerificationReview().baseline;
  requireVerificationUnchanged(before, { ...before, catalogSha256: '3'.repeat(64), inventorySha256: '4'.repeat(64) });
  for (const key of ['accountAuditSha256', 'targetCatalogSha256', 'managedExtensionSha256', 'migrationApprovalSha256'] as const) {
    assert.throws(() => requireVerificationUnchanged(before, { ...before, [key]: '0'.repeat(64) }));
  }
});
test('durable separate attempt is exclusive 0600, contains no credentials and preserves both original files', async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'sinegasi-verification-test-'));
  try {
    const r = syntheticVerificationReview(), d = documents();
    const currentFile = join(directory, basename(AUTH_CUSTODY_FILE)), previousFile = join(directory, basename(AUTH_TEMPORARY_FILE));
    await persistAuthCustody(currentFile, authRecord(JSON.parse(d.custodyRaw))); await persistAuthCustody(previousFile, authRecord(JSON.parse(d.temporaryRaw)));
    const currentBefore = await readFile(currentFile), previousBefore = await readFile(previousFile);
    const file = join(directory, basename(AUTH_VERIFICATION_ATTEMPT_FILE)); await requireNoVerificationAttempt(file);
    const credentials = readVerificationCredentialDocuments(d.custodyRaw, d.temporaryRaw);
    await persistVerificationAttempt(file, 'a'.repeat(64), r.bindings, credentials);
    const before = await readFile(file); assert.equal((await lstat(file)).mode & 0o777, 0o600);
    await assert.rejects(requireNoVerificationAttempt(file)); await assert.rejects(persistVerificationAttempt(file, 'b'.repeat(64), r.bindings, credentials));
    assert.deepEqual(await readFile(file), before); assert.deepEqual(await readFile(currentFile), currentBefore); assert.deepEqual(await readFile(previousFile), previousBefore);
    assert.doesNotMatch(before.toString(), /SyntheticExisting|SyntheticOriginal|"currentPassword"|"previousPassword"|"newPassword"|"temporaryPassword"/);
    await assert.rejects(persistVerificationAttempt(currentFile, 'a'.repeat(64), r.bindings, credentials), /AUTH_VERIFICATION_NEW_ATTEMPT_BINDINGS_REQUIRED/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('unsafe permissions, symlink and concurrent attempts cannot overwrite or replay the latch', async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'sinegasi-verification-test-'));
  try {
    const r = syntheticVerificationReview(), file = join(directory, basename(AUTH_VERIFICATION_ATTEMPT_FILE));
    await chmod(directory, 0o755); await assert.rejects(persistVerificationAttempt(file, 'a'.repeat(64), r.bindings, r.custody)); await chmod(directory, 0o700);
    const outcomes = await Promise.allSettled([persistVerificationAttempt(file, 'a'.repeat(64), r.bindings, r.custody),
      persistVerificationAttempt(file, 'b'.repeat(64), r.bindings, r.custody)]);
    assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
    const link = join(directory, 'partial-or-symlink.json'); await symlink(file, link); await assert.rejects(requireNoVerificationAttempt(link));
    await assert.rejects(persistVerificationAttempt(join(directory, 'wrong-target.json'), 'a'.repeat(64), r.bindings, r.custody));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('live verification constructor fixes origin/account and lacks any rotation capability, with a mocked upstream only', async () => {
  // The upstream is mocked; do not make fixture values resemble provider credentials.
  let forwarded = 0;
  const key = 'synthetic-verification-constructor-key';
  const t = createManagedAuthVerificationTransport(key, Date.now() + 60_000, () => {}, async (input, init) => {
    const request = new Request(input, init); assert.equal(new URL(request.url).origin, INTEGRATION_ORIGIN);
    forwarded++; return new Response('[]');
  });
  assert.equal('armRotation' in t, false);
  await t.fetch(INTEGRATION_ORIGIN + '/rest/v1/users?select=id&id=eq.' + AUTH_ACCOUNT.userId, { headers: { apikey: key } });
  await assert.rejects(t.fetch(INTEGRATION_ORIGIN + '/rest/v1/rpc/change_password_atomic', { method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' }, body: '{}' }), /AUTH_VERIFICATION_PASSWORD_MUTATION_FORBIDDEN/);
  await assert.rejects(t.fetch(INTEGRATION_ORIGIN + '/rest/v1/users?select=id&id=eq.' + AUTH_ACCOUNT.userId, { headers: { apikey: key } }));
  assert.equal(forwarded, 1); assert.equal(t.observations.rotationAttempts, 0);
});
test('failure reporter conservatively marks possible counter writes and partial latch, never leaks provider exceptions', () => {
  const t = createManagedAuthVerificationTransport('synthetic', Date.now() + 60_000, () => {}, async () => new Response('{}'));
  t.observations.writesAttempted = 1;
  const failure = verificationExecutorFailure(new Error('NeverPrintSyntheticProviderSecret'), {
    managed: true, attemptStarted: true, attemptPersisted: false, accountUnchangedVerified: false, transport: t });
  assert.equal(failure.productionChanged, 'unknown'); assert.equal(failure.productionPasswordChanged, false);
  assert.equal(failure.verificationAttemptPreserved, 'unknown'); assert.equal(failure.automaticRetryAllowed, false);
  assert.equal(failure.inspectBeforeAnyFurtherAction, true); assert.doesNotMatch(JSON.stringify(failure), /NeverPrint/);
  assert.equal(verificationExecutorFailure(new Error('offline'), { managed: false, attemptStarted: false,
    attemptPersisted: false, accountUnchangedVerified: false, transport: t }).productionChanged, false);
});
test('closing transport blocks delayed SDK global-fetch retries instead of restoring a native escape path', async () => {
  const previousFetch = globalThis.fetch;
  let forwarded = 0, unguarded = 0;
  let observed: () => void = () => {};
  const firstRequest = new Promise<void>(resolve => { observed = resolve; });
  const scope = { origin: 'https://verification-close.invalid', key: 'sb_secret_synthetic_close_only', ...AUTH_ACCOUNT,
    deadline: Date.now() + 60_000, beforeRequest() {} };
  const t = createIsolatedAuthVerificationTransport(scope, async () => {
    forwarded++; observed(); return new Response('{}', { status: 503 });
  });
  try {
    globalThis.fetch = async () => { unguarded++; throw new Error('Must not regain native fetch'); };
    const client = createClient(scope.origin, scope.key, { auth: { persistSession: false, autoRefreshToken: false } });
    // SDK has no custom fetch: the installed SDK reads global fetch at every attempt.
    globalThis.fetch = t.fetch;
    const query = client.from('users').select('id').eq('id', scope.userId).retry(true).abortSignal(AbortSignal.timeout(1200)).then(result => result);
    await firstRequest;
    t.close(); globalThis.fetch = t.fetch;
    assert.ok((await query).error);
    await assert.rejects(t.fetch(scope.origin + '/rest/v1/users?select=id&id=eq.' + scope.userId, { headers: { apikey: scope.key } }),
      /AUTH_VERIFICATION_TRANSPORT_CLOSED_NO_NETWORK/);
    assert.equal(forwarded, 1); assert.equal(unguarded, 0); assert.throws(t.assertHealthy);
  } finally { t.close(); globalThis.fetch = previousFetch; }
});
test('closing transport also refuses already queued counter requests before their forwarding', async () => {
  let release: () => void = () => {}, observed: () => void = () => {}, forwarded = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const firstRequest = new Promise<void>(resolve => { observed = resolve; });
  const key = 'sb_secret_synthetic_queue_only';
  const t = createManagedAuthVerificationTransport(key, Date.now() + 60_000, () => {}, async () => {
    forwarded++; observed(); await held; return new Response(null, { status: 204 });
  });
  const request = new Request(INTEGRATION_ORIGIN + '/rest/v1/rpc/clear_login_rate_limit', { method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ p_rate_key: t.counterKeys.login[0] }) });
  const first = t.fetch(request.clone()), queued = t.fetch(request.clone());
  const rejection = assert.rejects(queued, /AUTH_VERIFICATION_TRANSPORT_CLOSED_NO_NETWORK/);
  await firstRequest; t.close(); release(); await first; await rejection;
  assert.equal(forwarded, 1); assert.equal(t.observations.writesAttempted, 1);
});
test('runner has read-only PG/default TLS, no old rotation entry point, no listener/workers and no credential overwrite', async () => {
  const source = await readFile(runner, 'utf8');
  assert.match(source, /default_transaction_read_only=on/); assert.match(source, /REPEATABLE READ READ ONLY/);
  assert.match(source, /rejectUnauthorized: true/); assert.match(source, /FRESH_PROCESS_REQUIRED/);
  assert.doesNotMatch(source, /\.listen\(|\.startWorkers\(|runManagedAuthFlow\(|armRotation\(|mainAuthExecutor\(|createTemporaryPassword\(/);
  assert.doesNotMatch(source, /persistAuthCustody\(AUTH_(?:CUSTODY|TEMPORARY)_FILE/);
  assert.ok(source.indexOf("if (command.mode === 'rehearse')") < source.indexOf('await readKeychain('));
  assert.match(source, /requireNoVerificationAttempt\(AUTH_VERIFICATION_ATTEMPT_FILE\)/);
  assert.match(source, /requireVerificationCredentialMatch\(latest.user, credentials\)/);
  assert.match(source, /state.attemptPersisted = true/);
  assert.match(source, /state.transport.close\(\); globalThis.fetch = state.transport.fetch/);
});
