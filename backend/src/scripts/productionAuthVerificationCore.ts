import { dirname, normalize } from 'node:path';
import { verifyPassword } from '../services/passwordService.js';
import { AUTH_VERIFICATION_CHECKS } from './authVerificationFlow.js';
import { BACKUP_PROJECT } from './productionBackupCore.js';
import { AUTH_ACCOUNT, AUTH_BOOTSTRAP_RECEIPT_SHA, AUTH_MIGRATION_APPROVAL, AUTH_PRIVATE_ROOT,
  authDigest, authRecord, authRequire, AuthExecutorError, type AuthBaseline, type AuthExecutorBindings } from './productionAuthExecutorCore.js';
import { requireAuthAccountState } from './productionAuthBaseline.js';
import { sha256 } from './productionReconciliation.js';
import { backupTime, validateRecoveryArtifacts } from './reconciliationWriterPolicy.js';

export const AUTH_ROTATION_APPROVAL_SHA = '6c4ebf76aaf1e21d1e309e09209b1ff625e3504c15cf1661697d5ad27d2de58c';
export const AUTH_ROTATION_OBSERVED_AT = '2026-10-12T10:43:00.493Z';
export const AUTH_VERIFICATION_ATTEMPT_FILE = AUTH_PRIVATE_ROOT + '/first-teacher.admin.auth-verification-attempt.json';
export const AUTH_VERIFICATION_GUARDS = ['newCounterApprovalOnly', 'exactSourceAndEvidence', 'freshPostRotationBackupAndWindow',
  'existingCredentialMatch', 'durableAttemptBeforeRequests', 'passwordMutationsForbidden', 'accountAuditUnchanged', 'uncertainOutcomeNoRetry'] as const;
export const AUTH_VERIFICATION_OPERATION = 'post_rotation_teacher_auth_verification';

export type VerificationCommand = { mode: 'plan' | 'rehearse' | 'inspect' }
  | { mode: 'apply'; approval: string; checksum: string };
export function parseVerificationCommand(args: readonly string[]): VerificationCommand {
  if (args.length === 1 && (args[0] === 'plan' || args[0] === 'rehearse')) return { mode: args[0] };
  if (args.length === 3 && args[0] === 'inspect' && args[1] === '--keychain-ready' && args[2] === '--password-custody-ready') return { mode: 'inspect' };
  if (args.length === 7 && args[0] === 'apply' && args[1] === '--approval' && args[3] === '--confirm-approval'
    && args[5] === '--keychain-ready' && args[6] === '--password-custody-ready' && authDigest(args[4])
    && dirname(args[2]) === AUTH_PRIVATE_ROOT && normalize(args[2]) === args[2]
    && /^approval\.auth-verification\.[0-9TZ-]+\.json$/.test(args[2].slice(AUTH_PRIVATE_ROOT.length + 1))) {
    return { mode: 'apply', approval: args[2], checksum: args[4] };
  }
  throw new AuthExecutorError('USE_VERIFICATION_PLAN_REHEARSE_OR_NEW_EXPLICIT_VERIFICATION_APPROVAL');
}

export interface VerificationCredentials {
  currentPassword: string;
  previousPassword: string;
  passwordCustodySha256: string;
  temporaryCredentialSha256: string;
}
/** No generation/rehash/reset, and no original custody file is ever written. */
export function readVerificationCredentialDocuments(custodyRaw: string, temporaryRaw: string): VerificationCredentials {
  const custody = authRecord(JSON.parse(custodyRaw) as unknown), temporary = authRecord(JSON.parse(temporaryRaw) as unknown);
  authRequire(custody.format === 1 && custody.operation === 'first_teacher_auth_acceptance' && custody.project === BACKUP_PROJECT
    && custody.approvalSha256 === AUTH_ROTATION_APPROVAL_SHA && custody.automaticRetryAllowed === false
    && custody.executionState === 'prepared-outcome-must-be-inspected'
    && /^[a-f0-9]{40}$/.test(String(custody.releaseSha)) && authDigest(custody.runnerSourceSha256) && authDigest(custody.packageSha256)
    && typeof custody.createdAt === 'string' && Number.isFinite(Date.parse(custody.createdAt)) && Date.parse(custody.createdAt) <= Date.parse(AUTH_ROTATION_OBSERVED_AT)
    && temporary.version === 1 && temporary.projectRef === BACKUP_PROJECT && temporary.isFirstLogin === true
    && [custody, temporary].every(row => row.userId === AUTH_ACCOUNT.userId && row.username === AUTH_ACCOUNT.username
      && row.nama === AUTH_ACCOUNT.nama && row.role === 'teacher')
    && typeof custody.newPassword === 'string' && custody.newPassword.length >= 8 && custody.newPassword.length <= 128
    && typeof temporary.temporaryPassword === 'string' && temporary.temporaryPassword.length >= 8 && temporary.temporaryPassword.length <= 128
    && custody.newPassword !== temporary.temporaryPassword, 'AUTH_VERIFICATION_EXISTING_CREDENTIAL_DOCUMENTS_REQUIRED');
  return { currentPassword: custody.newPassword, previousPassword: temporary.temporaryPassword,
    passwordCustodySha256: sha256(custodyRaw), temporaryCredentialSha256: sha256(temporaryRaw) };
}
export async function requireVerificationCredentialMatch(user: Record<string, unknown>, credentials: VerificationCredentials): Promise<void> {
  requireAuthAccountState(user, true);
  authRequire(typeof user.password_hash === 'string' && /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(user.password_hash),
    'AUTH_VERIFICATION_VERSION_TWO_SCRYPT_REQUIRED');
  const current = await verifyPassword(credentials.currentPassword, user.password_hash);
  authRequire(current.valid && !current.needsRehash && !(await verifyPassword(credentials.previousPassword, user.password_hash)).valid,
    'AUTH_VERIFICATION_CUSTODY_HASH_MISMATCH_NO_LOGIN_OR_RESET');
}

export interface VerificationApproval extends AuthBaseline, AuthExecutorBindings {
  format: 1; operation: typeof AUTH_VERIFICATION_OPERATION; approved: true; project: typeof BACKUP_PROJECT;
  userId: typeof AUTH_ACCOUNT.userId; username: typeof AUTH_ACCOUNT.username; nama: typeof AUTH_ACCOUNT.nama; role: 'teacher';
  requiredAuthVersion: 2; requiredFirstLogin: false; rotationApprovalSha256: typeof AUTH_ROTATION_APPROVAL_SHA;
  passwordCustodySha256: string; temporaryCredentialSha256: string; bootstrapReceiptSha256: typeof AUTH_BOOTSTRAP_RECEIPT_SHA;
  backupId: string; archiveSha256: string; metadataSha256: string;
  recoveryEvidenceFile: string; recoveryEvidenceSha256: string; baselineEvidenceFile: string; baselineEvidenceSha256: string;
  rehearsalEvidenceFile: string; rehearsalEvidenceSha256: string; qualityRunId: number;
  windowStart: string; windowEnd: string; reviewedBy: string;
  macOnlyKeyRiskAcknowledged: true; sharedVpsRecoveryRiskAcknowledged: true; maintenanceWindowConfirmed: true;
  counterWritesOnlyAcknowledged: true; noPasswordMutationAcknowledged: true; existingPasswordCustodyAcknowledged: true;
  durableSeparateAttemptAcknowledged: true; noAutomaticRetryAcknowledged: true; noDeploymentAuthorized: true;
}
const digestFields = ['catalogSha256', 'inventorySha256', 'accountAuditSha256', 'managedExtensionSha256', 'targetCatalogSha256',
  'archiveSha256', 'metadataSha256', 'recoveryEvidenceSha256', 'baselineEvidenceSha256', 'rehearsalEvidenceSha256',
  'passwordCustodySha256', 'temporaryCredentialSha256'] as const;
const acknowledgements = ['macOnlyKeyRiskAcknowledged', 'sharedVpsRecoveryRiskAcknowledged', 'maintenanceWindowConfirmed',
  'counterWritesOnlyAcknowledged', 'noPasswordMutationAcknowledged', 'existingPasswordCustodyAcknowledged',
  'durableSeparateAttemptAcknowledged', 'noAutomaticRetryAcknowledged', 'noDeploymentAuthorized'] as const;
const approvalKeys = ['format', 'operation', 'approved', 'project', 'userId', 'username', 'nama', 'role', 'requiredAuthVersion', 'requiredFirstLogin',
  'rotationApprovalSha256', 'bootstrapReceiptSha256', 'releaseSha', 'runnerSourceSha256', 'packageSha256', 'migrationApprovalSha256',
  'backupId', 'recoveryEvidenceFile', 'baselineEvidenceFile', 'rehearsalEvidenceFile', 'qualityRunId', 'windowStart', 'windowEnd', 'reviewedBy',
  ...digestFields, ...acknowledgements];
export function requireVerificationWindow(a: Pick<VerificationApproval, 'windowStart' | 'windowEnd' | 'backupId'>, now: number): void {
  const start = Date.parse(a.windowStart), end = Date.parse(a.windowEnd), backup = backupTime(a.backupId);
  authRequire(Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 60 * 60_000
    && now >= start && now < end, 'AUTH_VERIFICATION_NEW_APPROVED_WINDOW_REQUIRED');
  authRequire(backup > Date.parse(AUTH_ROTATION_OBSERVED_AT) && backup <= now && now - backup <= 2 * 60 * 60_000,
    'AUTH_VERIFICATION_FRESH_POST_ROTATION_BACKUP_REQUIRED');
}
export function validateVerificationApproval(raw: string, checksum: string, bindings: AuthExecutorBindings, now: number): VerificationApproval {
  authRequire(authDigest(checksum) && sha256(raw) === checksum, 'AUTH_VERIFICATION_APPROVAL_CHECKSUM_MISMATCH');
  const a = authRecord(JSON.parse(raw) as unknown);
  authRequire(JSON.stringify(Object.keys(a).sort()) === JSON.stringify([...approvalKeys].sort())
    && a.format === 1 && a.operation === AUTH_VERIFICATION_OPERATION && a.approved === true && a.project === BACKUP_PROJECT
    && a.userId === AUTH_ACCOUNT.userId && a.username === AUTH_ACCOUNT.username && a.nama === AUTH_ACCOUNT.nama && a.role === 'teacher'
    && a.requiredAuthVersion === 2 && a.requiredFirstLogin === false && a.rotationApprovalSha256 === AUTH_ROTATION_APPROVAL_SHA
    && a.bootstrapReceiptSha256 === AUTH_BOOTSTRAP_RECEIPT_SHA && a.migrationApprovalSha256 === AUTH_MIGRATION_APPROVAL
    && /^[a-f0-9]{40}$/.test(bindings.releaseSha) && a.releaseSha === bindings.releaseSha
    && authDigest(bindings.runnerSourceSha256) && a.runnerSourceSha256 === bindings.runnerSourceSha256
    && authDigest(bindings.packageSha256) && a.packageSha256 === bindings.packageSha256
    && digestFields.every(key => authDigest(a[key])) && acknowledgements.every(key => a[key] === true)
    && typeof a.reviewedBy === 'string' && a.reviewedBy.trim().length > 0 && a.reviewedBy.length <= 160 && !/[\u0000-\u001f\u007f]/u.test(a.reviewedBy)
    && Number.isSafeInteger(a.qualityRunId) && Number(a.qualityRunId) > 0 && typeof a.windowStart === 'string' && typeof a.windowEnd === 'string'
    && typeof a.recoveryEvidenceFile === 'string' && /^recovery\.[0-9TZ-]+\.json$/.test(a.recoveryEvidenceFile)
    && typeof a.baselineEvidenceFile === 'string' && /^production-auth\.verification-baseline\.[0-9TZ-]+\.json$/.test(a.baselineEvidenceFile)
    && typeof a.rehearsalEvidenceFile === 'string' && /^production-auth\.verification-executor-rehearsal\.[0-9TZ-]+\.json$/.test(a.rehearsalEvidenceFile),
  'AUTH_VERIFICATION_NEW_COUNTER_ONLY_APPROVAL_REQUIRED');
  const approval = a as unknown as VerificationApproval;
  requireVerificationWindow(approval, now);
  return approval;
}

export interface VerificationEvidence { bootstrap: string; recovery: string; baseline: string; rehearsal: string }
/** Pinned original receipt, not reused first-rotation authorization. */
export function validateVerificationEvidence(a: VerificationApproval, evidence: VerificationEvidence, now: number): void {
  authRequire(sha256(evidence.bootstrap) === AUTH_BOOTSTRAP_RECEIPT_SHA, 'AUTH_VERIFICATION_BOOTSTRAP_RECEIPT_CHANGED');
  validateVerificationSupportingEvidence(a, evidence, now);
}
export function validateVerificationSupportingEvidence(a: VerificationApproval, evidence: Omit<VerificationEvidence, 'bootstrap'>, now: number): void {
  authRequire(sha256(evidence.recovery) === a.recoveryEvidenceSha256 && sha256(evidence.baseline) === a.baselineEvidenceSha256
    && sha256(evidence.rehearsal) === a.rehearsalEvidenceSha256, 'AUTH_VERIFICATION_EVIDENCE_CHECKSUM_MISMATCH');
  const baseline = authRecord(JSON.parse(evidence.baseline) as unknown), rehearsal = authRecord(JSON.parse(evidence.rehearsal) as unknown);
  const baselineTime = Date.parse(String(baseline.observedAt));
  authRequire(baseline.status === 'PRODUCTION_AUTH_VERIFICATION_VERSION_TWO_BASELINE' && baseline.project === BACKUP_PROJECT
    && baseline.productionChanged === false && baseline.accountStateVerified === true && baseline.passwordCustodyHashMatch === true
    && baseline.requiredAuthVersion === 2 && baseline.requiredFirstLogin === false && baseline.verificationAttemptExists === false
    && baseline.workingTreeDirty === false && baseline.releaseSha === a.releaseSha && baseline.runnerSourceSha256 === a.runnerSourceSha256
    && baseline.packageSha256 === a.packageSha256 && baseline.rotationApprovalSha256 === AUTH_ROTATION_APPROVAL_SHA
    && baseline.passwordCustodySha256 === a.passwordCustodySha256 && baseline.temporaryCredentialSha256 === a.temporaryCredentialSha256
    && (['catalogSha256', 'inventorySha256', 'accountAuditSha256', 'managedExtensionSha256', 'targetCatalogSha256', 'migrationApprovalSha256'] as const)
      .every(key => baseline[key] === a[key])
    && Number.isFinite(baselineTime) && baselineTime >= backupTime(a.backupId) && baselineTime <= now,
  'AUTH_VERIFICATION_POST_BACKUP_VERSION_TWO_BASELINE_REQUIRED');
  const guards = authRecord(rehearsal.guardChecks), fixture = authRecord(rehearsal.fixture), requests = authRecord(rehearsal.requests);
  authRequire(rehearsal.status === 'ISOLATED_AUTH_VERIFICATION_EXECUTOR_PASSED' && rehearsal.project === BACKUP_PROJECT
    && rehearsal.releaseSha === a.releaseSha && rehearsal.runnerSourceSha256 === a.runnerSourceSha256 && rehearsal.packageSha256 === a.packageSha256
    && rehearsal.workingTreeDirty === false && rehearsal.productionChanged === false && rehearsal.keychainAccessed === false
    && rehearsal.credentialFileRead === false && rehearsal.networkAccessed === false && rehearsal.accountFingerprintUnchanged === true
    && rehearsal.cleanupVerified === true && rehearsal.isolatedDurableAttemptTested === true
    && fixture.version === 2 && fixture.firstLogin === false && fixture.passwordChanges === 0 && fixture.passwordRpcCalls === 0
    && requests.rotationAttempts === 0 && requests.rotationOutcome === 'not-attempted' && requests.blocked === 0
    && JSON.stringify(rehearsal.checks) === JSON.stringify(AUTH_VERIFICATION_CHECKS) && AUTH_VERIFICATION_GUARDS.every(key => guards[key] === true),
  'AUTH_VERIFICATION_EXACT_EXECUTOR_REHEARSAL_REQUIRED');
  validateRecoveryArtifacts(JSON.parse(evidence.recovery) as unknown, a, now, key => {
    // This is a nonempty account verification, NOT an empty-database migration waiver.
    authRequire(a.macOnlyKeyRiskAcknowledged === true && a.sharedVpsRecoveryRiskAcknowledged === true
      && key.verified === false && key.sameDeviceAsMac === true && key.sameHostAsApplication === false
      && key.medium === 'macOS login Keychain only', 'AUTH_VERIFICATION_HONEST_MAC_ONLY_KEY_CUSTODY_REQUIRED');
  });
  const recovery = authRecord(JSON.parse(evidence.recovery) as unknown);
  authRequire(authRecord(recovery.receipt).publicTables === 73, 'AUTH_VERIFICATION_APPLICATION_BACKUP_REQUIRED');
}

/** Counters may change; full user/audit fingerprint, migration, schema and extension may not. */
export function requireVerificationUnchanged(before: AuthBaseline, after: AuthBaseline): void {
  authRequire(after.accountAuditSha256 === before.accountAuditSha256 && after.managedExtensionSha256 === before.managedExtensionSha256
    && after.targetCatalogSha256 === before.targetCatalogSha256 && after.migrationApprovalSha256 === before.migrationApprovalSha256,
  'AUTH_VERIFICATION_ACCOUNT_AUDIT_SCHEMA_OR_EXTENSION_CHANGED');
}
