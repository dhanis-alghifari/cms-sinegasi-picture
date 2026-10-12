import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { AUTH_FIXTURE_KEY, AUTH_FIXTURE_ORIGIN, AUTH_FIXTURE_USER_ID, type AuthAcceptanceFixture } from './authAcceptanceFixture.js';
import { AUTH_ACCOUNT, AUTH_BOOTSTRAP_RECEIPT_SHA, AUTH_MIGRATION_APPROVAL, AUTH_EXECUTOR_GUARD_CHECKS,
  authRequire, MANAGED_AUTH_CHECKS, validateAuthApproval, validateAuthEvidence, validateAuthSupportingEvidence,
  type AuthExecutorBindings } from './productionAuthExecutorCore.js';
import { createIsolatedAuthTransport } from './productionAuthTransport.js';
import { runManagedAuthFlow } from './productionAuthManagedFlow.js';
import { sha256 } from './productionReconciliation.js';

/** Synthetic documents stay in memory; never an operator approval or recovery attestation. */
export function syntheticAuthReview() {
  const now = Date.parse('2026-10-12T04:30:00.000Z'), backupId = '2026-10-12T04-00-00-000Z';
  const bindings: AuthExecutorBindings = { releaseSha: 'a'.repeat(40), runnerSourceSha256: 'b'.repeat(64), packageSha256: 'c'.repeat(64) };
  const baseline = { catalogSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64), accountAuditSha256: 'f'.repeat(64),
    managedExtensionSha256: '1'.repeat(64), targetCatalogSha256: '2'.repeat(64), migrationApprovalSha256: AUTH_MIGRATION_APPROVAL };
  const archive = { sha256: '3'.repeat(64), bytes: 1000 }, metadata = { sha256: '4'.repeat(64), bytes: 1000 };
  const evidence = { bootstrap: 'synthetic-bootstrap-receipt', recovery: JSON.stringify({ receipt: {
    project: 'pvbdiftvzoeelibxlxzb', id: backupId, encrypted: true, productionChanged: false, publicTables: 73, archive, metadata },
  restore: { project: 'pvbdiftvzoeelibxlxzb', id: backupId, status: 'PUBLIC_APPLICATION_RESTORE_VERIFIED', archiveSha256: archive.sha256,
    productionChanged: false, checks: { tableRowsAndRlsMatch: true, columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch: true, publicExtensionsMatch: true } },
  copy: { project: 'pvbdiftvzoeelibxlxzb', id: backupId, status: 'ENCRYPTED_VPS_COPY_VERIFIED', host: '43.157.242.8',
    destination: `/opt/sinegasi-backups/production/${backupId}`, directoryMode: '0700', fileMode: '0600', owner: 'root',
    offDeviceBackupCopyVerified: true, decryptionKeyTransferred: false, databaseCredentialsTransferred: false, productionChanged: false,
    devCaddyUnchanged: true, verifiedAt: '2026-10-12T04:05:00.000Z', files: [{ name: 'database.dump.age', ...archive }, { name: 'metadata.json.age', ...metadata }] },
  independentKeyRecovery: { verified: false, sameDeviceAsMac: true, sameHostAsApplication: false, medium: 'macOS login Keychain only' } }),
  baseline: JSON.stringify({ status: 'PRODUCTION_AUTH_POST_BOOTSTRAP_BASELINE', project: 'pvbdiftvzoeelibxlxzb', ...bindings, ...baseline,
    productionChanged: false, accountStateVerified: true, workingTreeDirty: false, observedAt: '2026-10-12T04:10:00.000Z' }),
  rehearsal: JSON.stringify({ status: 'ISOLATED_AUTH_EXECUTOR_PASSED', ...bindings, productionChanged: false, networkAccessed: false,
    workingTreeDirty: false, keychainAccessed: false, checks: MANAGED_AUTH_CHECKS,
    guardChecks: Object.fromEntries(AUTH_EXECUTOR_GUARD_CHECKS.map(key => [key, true])) }) };
  const approval = { format: 1, operation: 'first_teacher_auth_acceptance', approved: true, project: 'pvbdiftvzoeelibxlxzb',
    ...AUTH_ACCOUNT, ...bindings, ...baseline, backupId, archiveSha256: archive.sha256, metadataSha256: metadata.sha256,
    recoveryEvidenceFile: `recovery.${backupId}.json`, recoveryEvidenceSha256: sha256(evidence.recovery),
    baselineEvidenceFile: `production-auth.baseline.${backupId}.json`, baselineEvidenceSha256: sha256(evidence.baseline),
    rehearsalEvidenceFile: `production-auth.executor-rehearsal.${backupId}.json`, rehearsalEvidenceSha256: sha256(evidence.rehearsal),
    bootstrapReceiptSha256: AUTH_BOOTSTRAP_RECEIPT_SHA, qualityRunId: 1, windowStart: '2026-10-12T04:20:00.000Z',
    windowEnd: '2026-10-12T05:00:00.000Z', reviewedBy: 'synthetic fixture only', macOnlyKeyRiskAcknowledged: true,
    sharedVpsRecoveryRiskAcknowledged: true, maintenanceWindowConfirmed: true, oneRotationOnlyAcknowledged: true,
    counterAndAuditWritesAcknowledged: true, noAutomaticRetryAcknowledged: true, noDeploymentAuthorized: true,
    privatePasswordCustodyAcknowledged: true };
  return { now, bindings, approval, evidence };
}

export async function rehearseExecutorGuards(app: FastifyInstance, fixture: AuthAcceptanceFixture): Promise<Record<string, boolean>> {
  const review = syntheticAuthReview(), raw = JSON.stringify(review.approval);
  const valid = validateAuthApproval(raw, sha256(raw), review.bindings, review.now);
  const reject = (changes: Record<string, unknown>, now = review.now) => {
    const changed = JSON.stringify({ ...review.approval, ...changes });
    assert.throws(() => validateAuthApproval(changed, sha256(changed), review.bindings, now));
  };
  for (const operation of ['bootstrap_first_teacher', 'production_reconciliation']) reject({ operation });
  for (const changes of [{ project: 'different-project' }, { userId: AUTH_FIXTURE_USER_ID }, { role: 'admin' },
    { releaseSha: '9'.repeat(40) }, { runnerSourceSha256: '9'.repeat(64) }, { isolatedFixture: true }, { approved: false }]) reject(changes);
  assert.throws(() => validateAuthApproval(raw, '0'.repeat(64), review.bindings, review.now));
  reject({}, Date.parse(review.approval.windowEnd)); reject({ backupId: '2026-10-12T01-52-44-292Z' });
  reject({ windowEnd: '2026-10-12T06:00:00.000Z' });
  // The historical receipt digest is pinned; the synthetic receipt cannot pass that gate.
  assert.throws(() => validateAuthEvidence(valid, review.evidence, review.now));
  // Test the remaining evidence checks without substituting any real private document.
  validateAuthSupportingEvidence(valid, review.evidence, review.now);
  for (const key of ['baseline', 'recovery', 'rehearsal'] as const) {
    assert.throws(() => validateAuthSupportingEvidence(valid, { ...review.evidence, [key]: '{}' }, review.now));
  }
  const scope = { origin: AUTH_FIXTURE_ORIGIN, key: AUTH_FIXTURE_KEY, userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru',
    newPassword: fixture.newPassword, deadline: Date.now() + 60_000, beforeRequest() {} };
  let forwarded = 0;
  for (const request of [new Request('https://example.com/rest/v1/users'), new Request(`${AUTH_FIXTURE_ORIGIN}/auth/v1/token`),
    new Request(`${AUTH_FIXTURE_ORIGIN}/rest/v1/users`, { method: 'DELETE' }),
    new Request(`${AUTH_FIXTURE_ORIGIN}/rest/v1/users?select=*`),
    new Request(`${AUTH_FIXTURE_ORIGIN}/rest/v1/users?select=id&id=eq.another-account`)]) {
    const transport = createIsolatedAuthTransport(scope, async () => { forwarded++; return new Response('{}'); });
    request.headers.set('apikey', AUTH_FIXTURE_KEY);
    await assert.rejects(transport.fetch(request));
  }
  assert.equal(forwarded, 0);
  const transport = createIsolatedAuthTransport(scope, fixture.fetch);
  const before = fixture.snapshot().requests;
  await assert.rejects(runManagedAuthFlow(app, { account: { userId: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', nama: 'Guru Terisolasi', role: 'teacher' },
    temporaryPassword: fixture.temporaryPassword, newPassword: fixture.newPassword, transport,
    persistCustody: async () => { throw new Error('synthetic custody failure'); }, beforeRotation: async () => {}, verifyPostcondition: async () => {} }));
  assert.equal(fixture.snapshot().requests, before);
  const { hashPassword } = await import('../services/passwordService.js');
  const request = new Request(`${AUTH_FIXTURE_ORIGIN}/rest/v1/rpc/change_password_atomic`, { method: 'POST',
    headers: { apikey: AUTH_FIXTURE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_user_id: AUTH_FIXTURE_USER_ID,
      p_updated_by: AUTH_FIXTURE_USER_ID, p_expected_auth_version: 1, p_change_reason: 'Pengguna mengganti password akun',
      p_password_hash: await hashPassword(fixture.newPassword) }) });
  const uncertain = createIsolatedAuthTransport(scope, async () => { forwarded++; throw new Error('synthetic lost acknowledgement'); });
  uncertain.armRotation(); await assert.rejects(uncertain.fetch(request.clone()));
  await assert.rejects(uncertain.fetch(request.clone())); assert.equal(forwarded, 1);
  assert.equal(uncertain.observations.rotationAttempts, 1); assert.equal(uncertain.observations.rotationOutcome, 'unknown');
  return { newApprovalOnly: true, scopeAndChecksum: true, freshWindowAndBackup: true, evidenceAndBaseline: true,
    custodyBeforeRequests: true, transportAllowlist: true, singleRotation: true, uncertainOutcomeNoRetry: true };
}

export function requireExecutorFixturePostcondition(fixture: AuthAcceptanceFixture): void {
  const state = fixture.snapshot();
  authRequire(state.version === 2 && state.firstLogin === false && state.passwordChanges === 1 && state.passwordRpcCalls === 1
    && state.blocked === 0, 'AUTH_EXECUTOR_FIXTURE_POSTCONDITION');
}
