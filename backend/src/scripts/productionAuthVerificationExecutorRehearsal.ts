import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { AUTH_ACCOUNT, AUTH_BOOTSTRAP_RECEIPT_SHA, AUTH_MIGRATION_APPROVAL, authRecord, authRequire, type AuthExecutorBindings } from './productionAuthExecutorCore.js';
import { AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_USER_ID, createAuthAcceptanceFixture } from './authAcceptanceFixture.js';
import { createIsolatedAuthVerificationTransport } from './productionAuthTransport.js';
import { AUTH_VERIFICATION_CHECKS } from './authVerificationFlow.js';
import { AUTH_VERIFICATION_ATTEMPT_FILE, AUTH_VERIFICATION_GUARDS, AUTH_VERIFICATION_OPERATION, AUTH_ROTATION_APPROVAL_SHA,
  readVerificationCredentialDocuments, requireVerificationCredentialMatch, requireVerificationUnchanged,
  validateVerificationApproval, validateVerificationEvidence, validateVerificationSupportingEvidence } from './productionAuthVerificationCore.js';
import { persistVerificationAttempt, requireNoVerificationAttempt } from './productionAuthVerificationAttempt.js';
import { syntheticAuthReview } from './productionAuthExecutorRehearsal.js';
import { sha256 } from './productionReconciliation.js';
import { hashPassword } from '../services/passwordService.js';

/** Synthetic memory documents, never an operator approval or real backup/recovery assertion. */
export function syntheticVerificationReview() {
  const now = Date.parse('2026-10-13T03:30:00.000Z'), backupId = '2026-10-13T03-00-00-000Z';
  const bindings: AuthExecutorBindings = { releaseSha: 'a'.repeat(40), runnerSourceSha256: 'b'.repeat(64), packageSha256: 'c'.repeat(64) };
  const baseline = { catalogSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64), accountAuditSha256: 'f'.repeat(64),
    managedExtensionSha256: '1'.repeat(64), targetCatalogSha256: '2'.repeat(64), migrationApprovalSha256: AUTH_MIGRATION_APPROVAL };
  const recovery = authRecord(JSON.parse(syntheticAuthReview().evidence.recovery) as unknown);
  const receipt = authRecord(recovery.receipt), restore = authRecord(recovery.restore), copy = authRecord(recovery.copy);
  for (const value of [receipt, restore, copy]) value.id = backupId;
  copy.destination = '/opt/sinegasi-backups/production/' + backupId;
  copy.verifiedAt = '2026-10-13T03:05:00.000Z';
  const custody = { passwordCustodySha256: '5'.repeat(64), temporaryCredentialSha256: '6'.repeat(64) };
  const evidence = { bootstrap: 'synthetic-bootstrap-receipt-not-the-pinned-original', recovery: JSON.stringify(recovery),
    baseline: JSON.stringify({ status: 'PRODUCTION_AUTH_VERIFICATION_VERSION_TWO_BASELINE', project: 'pvbdiftvzoeelibxlxzb', ...bindings, ...baseline,
      ...custody, rotationApprovalSha256: AUTH_ROTATION_APPROVAL_SHA, productionChanged: false, accountStateVerified: true,
      passwordCustodyHashMatch: true, requiredAuthVersion: 2, requiredFirstLogin: false, verificationAttemptExists: false,
      workingTreeDirty: false, observedAt: '2026-10-13T03:10:00.000Z' }),
    rehearsal: JSON.stringify({ status: 'ISOLATED_AUTH_VERIFICATION_EXECUTOR_PASSED', project: 'pvbdiftvzoeelibxlxzb', ...bindings,
      workingTreeDirty: false, productionChanged: false, keychainAccessed: false, credentialFileRead: false, networkAccessed: false,
      accountFingerprintUnchanged: true, cleanupVerified: true, isolatedDurableAttemptTested: true, checks: AUTH_VERIFICATION_CHECKS,
      fixture: { version: 2, firstLogin: false, passwordChanges: 0, passwordRpcCalls: 0 },
      requests: { rotationAttempts: 0, rotationOutcome: 'not-attempted', blocked: 0 },
      guardChecks: Object.fromEntries(AUTH_VERIFICATION_GUARDS.map(key => [key, true])) }) };
  const approval = { format: 1, operation: AUTH_VERIFICATION_OPERATION, approved: true, project: 'pvbdiftvzoeelibxlxzb',
    ...AUTH_ACCOUNT, ...bindings, ...baseline, ...custody, requiredAuthVersion: 2, requiredFirstLogin: false,
    rotationApprovalSha256: AUTH_ROTATION_APPROVAL_SHA, bootstrapReceiptSha256: AUTH_BOOTSTRAP_RECEIPT_SHA,
    backupId, archiveSha256: authRecord(receipt.archive).sha256, metadataSha256: authRecord(receipt.metadata).sha256,
    recoveryEvidenceFile: `recovery.${backupId}.json`, recoveryEvidenceSha256: sha256(evidence.recovery),
    baselineEvidenceFile: `production-auth.verification-baseline.${backupId}.json`, baselineEvidenceSha256: sha256(evidence.baseline),
    rehearsalEvidenceFile: `production-auth.verification-executor-rehearsal.${backupId}.json`, rehearsalEvidenceSha256: sha256(evidence.rehearsal),
    qualityRunId: 1, windowStart: '2026-10-13T03:20:00.000Z', windowEnd: '2026-10-13T04:00:00.000Z', reviewedBy: 'synthetic fixture only',
    macOnlyKeyRiskAcknowledged: true, sharedVpsRecoveryRiskAcknowledged: true, maintenanceWindowConfirmed: true,
    counterWritesOnlyAcknowledged: true, noPasswordMutationAcknowledged: true, existingPasswordCustodyAcknowledged: true,
    durableSeparateAttemptAcknowledged: true, noAutomaticRetryAcknowledged: true, noDeploymentAuthorized: true };
  return { now, bindings, baseline, custody, approval, evidence };
}

/** Executes policy and durable-file guards using only synthetic data and a disposable OS temp directory. */
export async function rehearseVerificationExecutorGuards(): Promise<Record<typeof AUTH_VERIFICATION_GUARDS[number], boolean>> {
  const review = syntheticVerificationReview(), raw = JSON.stringify(review.approval);
  const a = validateVerificationApproval(raw, sha256(raw), review.bindings, review.now);
  const reject = (changes: Record<string, unknown>, now = review.now) => {
    const changed = JSON.stringify({ ...review.approval, ...changes });
    assert.throws(() => validateVerificationApproval(changed, sha256(changed), review.bindings, now));
  };
  for (const changes of [{ operation: 'first_teacher_auth_acceptance' }, { operation: 'bootstrap_first_teacher' },
    { requiredAuthVersion: 1 }, { noPasswordMutationAcknowledged: false }, { password: 'never accepted' },
    { releaseSha: '0'.repeat(40) }, { role: 'admin' }, { approved: false }]) reject(changes);
  assert.throws(() => validateVerificationApproval(raw, '0'.repeat(64), review.bindings, review.now));
  reject({}, Date.parse(a.windowEnd)); reject({ backupId: '2026-10-12T09-45-03-762Z' });
  validateVerificationSupportingEvidence(a, review.evidence, review.now);
  assert.throws(() => validateVerificationEvidence(a, review.evidence, review.now)); // Synthetic receipt must NOT satisfy the original pin.
  for (const key of ['baseline', 'recovery', 'rehearsal'] as const) {
    assert.throws(() => validateVerificationSupportingEvidence(a, { ...review.evidence, [key]: '{}' }, review.now));
  }
  requireVerificationUnchanged(review.baseline, { ...review.baseline, catalogSha256: '7'.repeat(64), inventorySha256: '8'.repeat(64) });
  assert.throws(() => requireVerificationUnchanged(review.baseline, { ...review.baseline, accountAuditSha256: '0'.repeat(64) }));
  const fixture = await createAuthAcceptanceFixture('rotated');
  const custodyRaw = JSON.stringify({ format: 1, operation: 'first_teacher_auth_acceptance', project: 'pvbdiftvzoeelibxlxzb', ...AUTH_ACCOUNT,
    ...review.bindings, approvalSha256: AUTH_ROTATION_APPROVAL_SHA, automaticRetryAllowed: false,
    executionState: 'prepared-outcome-must-be-inspected', createdAt: '2026-10-12T10:42:00.000Z', newPassword: fixture.newPassword });
  const temporaryRaw = JSON.stringify({ version: 1, projectRef: 'pvbdiftvzoeelibxlxzb', ...AUTH_ACCOUNT,
    isFirstLogin: true, temporaryPassword: fixture.temporaryPassword });
  const credentials = readVerificationCredentialDocuments(custodyRaw, temporaryRaw);
  const user = { ...AUTH_ACCOUNT, id: AUTH_ACCOUNT.userId, auth_version: 2, is_first_login: false, is_active: true,
    password_hash: await hashPassword(credentials.currentPassword) };
  await requireVerificationCredentialMatch(user, credentials);
  await assert.rejects(requireVerificationCredentialMatch(user, { ...credentials, currentPassword: 'SyntheticWrongCustodyPassword2' }));
  await assert.rejects(requireVerificationCredentialMatch({ ...user, password_hash: credentials.currentPassword }, credentials));
  const scope = { origin: AUTH_FIXTURE_ORIGIN, key: AUTH_FIXTURE_KEY, userId: AUTH_FIXTURE_USER_ID,
    username: 'fixture_guru', deadline: Date.now() + 60_000, beforeRequest() {} };
  let forwarded = 0;
  for (const path of ['/rest/v1/rpc/change_password_atomic', '/rest/v1/rpc/reset_password_atomic', '/rest/v1/users']) {
    const transport = createIsolatedAuthVerificationTransport(scope, async () => { forwarded++; return new Response('{}'); });
    await assert.rejects(transport.fetch(scope.origin + path, { method: 'POST',
      headers: { apikey: scope.key, 'content-type': 'application/json' }, body: '{}' }));
  }
  const unlatched = createIsolatedAuthVerificationTransport({ ...scope, beforeRequest() { authRequire(false, 'SYNTHETIC_DURABLE_ATTEMPT_REQUIRED'); } },
    async () => { forwarded++; return new Response('[]'); });
  await assert.rejects(unlatched.fetch(scope.origin + '/rest/v1/users?select=id&id=eq.' + scope.userId, { headers: { apikey: scope.key } }));
  assert.equal(forwarded, 0);
  const lost = createIsolatedAuthVerificationTransport(scope, async () => { forwarded++; throw new Error('Synthetic provider failure'); });
  const request = new Request(scope.origin + '/rest/v1/rpc/clear_login_rate_limit', { method: 'POST',
    headers: { apikey: scope.key, 'content-type': 'application/json' }, body: JSON.stringify({ p_rate_key: lost.counterKeys.login[0] }) });
  await assert.rejects(lost.fetch(request.clone())); await assert.rejects(lost.fetch(request.clone()));
  assert.equal(forwarded, 1); assert.equal(lost.observations.writesAttempted, 1); assert.equal(lost.observations.rotationAttempts, 0);
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'sinegasi-auth-verification-'));
  try {
    const file = join(directory, basename(AUTH_VERIFICATION_ATTEMPT_FILE));
    await requireNoVerificationAttempt(file);
    await persistVerificationAttempt(file, sha256(raw), review.bindings, review.custody);
    const original = await readFile(file);
    await assert.rejects(requireNoVerificationAttempt(file));
    await assert.rejects(persistVerificationAttempt(file, '0'.repeat(64), review.bindings, review.custody));
    assert.deepEqual(await readFile(file), original);
  } finally { await rm(directory, { recursive: true, force: true }); }
  return { newCounterApprovalOnly: true, exactSourceAndEvidence: true, freshPostRotationBackupAndWindow: true,
    existingCredentialMatch: true, durableAttemptBeforeRequests: true, passwordMutationsForbidden: true,
    accountAuditUnchanged: true, uncertainOutcomeNoRetry: true };
}
