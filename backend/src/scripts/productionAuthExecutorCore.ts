import { dirname, normalize } from 'node:path';
import { BACKUP_PROJECT } from './productionBackupCore.js';
import { sha256 } from './productionReconciliation.js';
import { backupTime, object, validateWriterRecovery } from './reconciliationWriterPolicy.js';

export const AUTH_ACCOUNT = { userId: '2553f46c-5e6f-461d-ac4f-f24d4dced9ef', username: 'admin', nama: 'visioner', role: 'teacher' } as const;
export const AUTH_PRIVATE_ROOT = '/Users/memberid/Library/Application Support/Sinegasi/Reconciliation';
export const AUTH_TEMPORARY_FILE = AUTH_PRIVATE_ROOT + '/first-teacher.admin.2026-10-12.json';
// Account-wide, not approval-specific: a second approval cannot silently replay a partial run.
export const AUTH_CUSTODY_FILE = AUTH_PRIVATE_ROOT + '/first-teacher.admin.auth-attempt.json';
export const AUTH_BOOTSTRAP_RECEIPT = 'bootstrap-first-teacher.result.2026-10-12T02-24-25-902Z.json';
export const AUTH_BOOTSTRAP_RECEIPT_SHA = '17465648f65d80fdad7ff8c799ded440a0c5e32c64d6dc2f18df9acfa85e27de';
export const AUTH_MIGRATION_APPROVAL = '48bcc8bd6ff2ef894d136513c9b4f7e52213f6bc090acabd76e7f7fc9e1e5715';

export class AuthExecutorError extends Error {
  constructor(public readonly stage: string) { super(stage); this.name = 'AuthExecutorError'; }
}
export function authRequire(condition: unknown, stage: string): asserts condition {
  if (!condition) throw new AuthExecutorError(stage);
}
export function authRecord(value: unknown): Record<string, unknown> {
  authRequire(value && typeof value === 'object' && !Array.isArray(value), 'AUTH_EXECUTOR_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}
export function authDigest(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }

export type AuthExecutorCommand = { mode: 'plan' } | { mode: 'rehearse' } | { mode: 'inspect' }
  | { mode: 'apply'; approval: string; checksum: string };
export function parseAuthExecutorCommand(args: readonly string[]): AuthExecutorCommand {
  if (args.length === 1 && (args[0] === 'plan' || args[0] === 'rehearse')) return { mode: args[0] };
  if (args.length === 2 && args[0] === 'inspect' && args[1] === '--keychain-ready') return { mode: 'inspect' };
  if (args.length === 7 && args[0] === 'apply' && args[1] === '--approval' && args[3] === '--confirm-approval'
    && args[5] === '--keychain-ready' && args[6] === '--password-custody-ready'
    && dirname(args[2]) === AUTH_PRIVATE_ROOT && normalize(args[2]) === args[2]
    && /^approval\.auth\.[0-9TZ-]+\.json$/.test(args[2].slice(AUTH_PRIVATE_ROOT.length + 1)) && authDigest(args[4])) {
    return { mode: 'apply', approval: args[2], checksum: args[4] };
  }
  throw new AuthExecutorError('USE_OFFLINE_PLAN_REHEARSE_OR_EXPLICIT_REVIEWED_MANAGED_COMMAND');
}

export interface AuthExecutorBindings { releaseSha: string; runnerSourceSha256: string; packageSha256: string }
export interface AuthBaseline {
  catalogSha256: string; inventorySha256: string; accountAuditSha256: string;
  managedExtensionSha256: string; targetCatalogSha256: string; migrationApprovalSha256: string;
}
export interface AuthExecutorApproval extends AuthExecutorBindings, AuthBaseline {
  format: 1; operation: 'first_teacher_auth_acceptance'; approved: true; project: typeof BACKUP_PROJECT;
  userId: typeof AUTH_ACCOUNT.userId; username: typeof AUTH_ACCOUNT.username; nama: typeof AUTH_ACCOUNT.nama; role: 'teacher';
  backupId: string; archiveSha256: string; metadataSha256: string;
  recoveryEvidenceFile: string; recoveryEvidenceSha256: string;
  baselineEvidenceFile: string; baselineEvidenceSha256: string;
  rehearsalEvidenceFile: string; rehearsalEvidenceSha256: string;
  bootstrapReceiptSha256: typeof AUTH_BOOTSTRAP_RECEIPT_SHA;
  qualityRunId: number; windowStart: string; windowEnd: string; reviewedBy: string;
  macOnlyKeyRiskAcknowledged: true; sharedVpsRecoveryRiskAcknowledged: true;
  maintenanceWindowConfirmed: true; oneRotationOnlyAcknowledged: true;
  counterAndAuditWritesAcknowledged: true; noAutomaticRetryAcknowledged: true;
  noDeploymentAuthorized: true; privatePasswordCustodyAcknowledged: true;
}
export function requireAuthWindow(a: Pick<AuthExecutorApproval, 'windowStart' | 'windowEnd' | 'backupId'>, now: number): void {
  const start = Date.parse(a.windowStart), end = Date.parse(a.windowEnd), backup = backupTime(a.backupId);
  authRequire(Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) && end > start
    && end - start <= 60 * 60_000 && now >= start && now < end, 'AUTH_APPROVED_WINDOW_REQUIRED');
  authRequire(backup <= now && now - backup <= 2 * 60 * 60_000, 'AUTH_FRESH_POST_BOOTSTRAP_BACKUP_REQUIRED');
}

/** Deliberately distinct from migration/bootstrap authorization; fixed account, no URL/password override. */
export function validateAuthApproval(raw: string, checksum: string, bindings: AuthExecutorBindings, now: number): AuthExecutorApproval {
  authRequire(authDigest(checksum) && sha256(raw) === checksum, 'AUTH_APPROVAL_CHECKSUM_MISMATCH');
  const a = authRecord(JSON.parse(raw) as unknown);
  authRequire(a.format === 1 && a.operation === 'first_teacher_auth_acceptance' && a.approved === true
    && a.project === BACKUP_PROJECT && a.isolatedFixture === undefined
    && a.userId === AUTH_ACCOUNT.userId && a.username === AUTH_ACCOUNT.username && a.nama === AUTH_ACCOUNT.nama && a.role === 'teacher'
    && /^[a-f0-9]{40}$/.test(bindings.releaseSha) && a.releaseSha === bindings.releaseSha
    && authDigest(bindings.runnerSourceSha256) && a.runnerSourceSha256 === bindings.runnerSourceSha256
    && authDigest(bindings.packageSha256) && a.packageSha256 === bindings.packageSha256
    && a.bootstrapReceiptSha256 === AUTH_BOOTSTRAP_RECEIPT_SHA && a.migrationApprovalSha256 === AUTH_MIGRATION_APPROVAL
    && ['catalogSha256', 'inventorySha256', 'accountAuditSha256', 'targetCatalogSha256', 'managedExtensionSha256',
      'archiveSha256', 'metadataSha256', 'recoveryEvidenceSha256', 'baselineEvidenceSha256', 'rehearsalEvidenceSha256'].every(key => authDigest(a[key]))
    && ['macOnlyKeyRiskAcknowledged', 'sharedVpsRecoveryRiskAcknowledged', 'maintenanceWindowConfirmed',
      'oneRotationOnlyAcknowledged', 'counterAndAuditWritesAcknowledged', 'noAutomaticRetryAcknowledged',
      'noDeploymentAuthorized', 'privatePasswordCustodyAcknowledged'].every(key => a[key] === true)
    && typeof a.reviewedBy === 'string' && a.reviewedBy.trim().length > 0 && a.reviewedBy.length <= 160
    && !/[\u0000-\u001f\u007f]/u.test(a.reviewedBy) && Number.isSafeInteger(a.qualityRunId) && Number(a.qualityRunId) > 0
    && typeof a.windowStart === 'string' && typeof a.windowEnd === 'string'
    && typeof a.recoveryEvidenceFile === 'string' && /^recovery\.[0-9TZ-]+\.json$/.test(a.recoveryEvidenceFile)
    && typeof a.baselineEvidenceFile === 'string' && /^production-auth\.baseline\.[0-9TZ-]+\.json$/.test(a.baselineEvidenceFile)
    && typeof a.rehearsalEvidenceFile === 'string' && /^production-auth\.executor-rehearsal\.[0-9TZ-]+\.json$/.test(a.rehearsalEvidenceFile),
  'NEW_SCOPED_AUTH_APPROVAL_REQUIRED');
  const approval = a as unknown as AuthExecutorApproval;
  requireAuthWindow(approval, now);
  return approval;
}

export const MANAGED_AUTH_CHECKS = ['LIVENESS_AND_SECURITY_HEADERS', 'ANONYMOUS_PROTECTED_READ_DENIED',
  'TEMPORARY_PASSWORD_LOGIN_FIRST_LOGIN_REQUIRED', 'FIRST_LOGIN_ME_ALLOWED', 'FIRST_LOGIN_BUSINESS_READ_BLOCKED',
  'PASSWORD_ROTATION_UPDATES_SESSION', 'PREVIOUS_TOKEN_REVOKED', 'PREVIOUS_PASSWORD_DENIED',
  'NEW_PASSWORD_LOGIN_SUCCEEDS', 'BUSINESS_READ_ALLOWED_AFTER_ROTATION',
  'LOGOUT_ACKNOWLEDGED_WITHOUT_SERVER_REVOCATION'] as const;
export const AUTH_EXECUTOR_GUARD_CHECKS = ['newApprovalOnly', 'scopeAndChecksum', 'freshWindowAndBackup',
  'evidenceAndBaseline', 'custodyBeforeRequests', 'transportAllowlist', 'singleRotation', 'uncertainOutcomeNoRetry'] as const;

export function validateAuthEvidence(a: AuthExecutorApproval, evidence: {
  bootstrap: string; recovery: string; baseline: string; rehearsal: string;
}, now: number): void {
  authRequire(a.bootstrapReceiptSha256 === AUTH_BOOTSTRAP_RECEIPT_SHA, 'AUTH_ORIGINAL_BOOTSTRAP_RECEIPT_REQUIRED');
  authRequire(sha256(evidence.bootstrap) === a.bootstrapReceiptSha256, 'AUTH_EVIDENCE_CHECKSUM_MISMATCH');
  validateAuthSupportingEvidence(a, evidence, now);
}

/** Separated so synthetic tests need no access to the real pinned bootstrap receipt. */
export function validateAuthSupportingEvidence(a: AuthExecutorApproval, evidence: {
  recovery: string; baseline: string; rehearsal: string;
}, now: number): void {
  authRequire(sha256(evidence.recovery) === a.recoveryEvidenceSha256 && sha256(evidence.baseline) === a.baselineEvidenceSha256
    && sha256(evidence.rehearsal) === a.rehearsalEvidenceSha256, 'AUTH_EVIDENCE_CHECKSUM_MISMATCH');
  const baseline = authRecord(JSON.parse(evidence.baseline) as unknown);
  const rehearsal = authRecord(JSON.parse(evidence.rehearsal) as unknown);
  authRequire(baseline.status === 'PRODUCTION_AUTH_POST_BOOTSTRAP_BASELINE' && baseline.project === BACKUP_PROJECT
    && baseline.productionChanged === false && baseline.accountStateVerified === true
    && baseline.releaseSha === a.releaseSha && baseline.runnerSourceSha256 === a.runnerSourceSha256
    && baseline.packageSha256 === a.packageSha256 && baseline.workingTreeDirty === false
    && (['catalogSha256', 'inventorySha256', 'accountAuditSha256', 'targetCatalogSha256',
      'migrationApprovalSha256', 'managedExtensionSha256'] as const).every(key => baseline[key] === a[key])
    && Number.isFinite(Date.parse(String(baseline.observedAt))) && Date.parse(String(baseline.observedAt)) <= now
    && Date.parse(String(baseline.observedAt)) >= backupTime(a.backupId), 'AUTH_POST_BACKUP_BASELINE_REQUIRED');
  const guardChecks = authRecord(rehearsal.guardChecks);
  authRequire(rehearsal.status === 'ISOLATED_AUTH_EXECUTOR_PASSED' && rehearsal.runnerSourceSha256 === a.runnerSourceSha256
    && rehearsal.releaseSha === a.releaseSha && rehearsal.productionChanged === false && rehearsal.networkAccessed === false
    && rehearsal.workingTreeDirty === false && rehearsal.keychainAccessed === false && rehearsal.packageSha256 === a.packageSha256
    && Array.isArray(rehearsal.checks) && JSON.stringify(rehearsal.checks) === JSON.stringify(MANAGED_AUTH_CHECKS)
    && AUTH_EXECUTOR_GUARD_CHECKS.every(key => guardChecks[key] === true), 'AUTH_EXACT_EXECUTOR_REHEARSAL_REQUIRED');
  // Reuse ciphertext/restore/copy validation, not the old empty-production scope.
  // This operation has its own explicit post-bootstrap Mac-only risk acceptance.
  validateWriterRecovery(JSON.parse(evidence.recovery) as unknown, { backupId: a.backupId, archiveSha256: a.archiveSha256,
    metadataSha256: a.metadataSha256, recoveryMode: 'mac-only-initialization',
    macOnlyRecoveryRiskAcknowledged: true, initialEmptyProductionOnly: true }, now);
  const receipt = object(object(JSON.parse(evidence.recovery) as unknown).receipt);
  authRequire(backupTime(a.backupId) > Date.parse('2026-10-12T02:24:25.902Z') && receipt.publicTables === 73,
    'AUTH_BACKUP_MUST_INCLUDE_CREATED_TEACHER');
}
