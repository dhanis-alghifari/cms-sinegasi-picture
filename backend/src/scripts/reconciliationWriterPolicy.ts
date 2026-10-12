import { BACKUP_PROJECT } from './productionBackupCore.js';
import { compileProductionReconciliation, compileReconciliation, sha256, type SchemaSnapshot } from './productionReconciliation.js';
import { createReferenceDataPlan, type ReferenceDataPlan } from './productionReferenceData.js';

export class WriterError extends Error {
  constructor(public readonly stage: string, public readonly mutation: 'none' | 'enums' | 'complete' | 'unknown' = 'none') {
    super(stage); this.name = 'WriterError';
  }
}

export interface WriterPackage {
  snapshot: SchemaSnapshot;
  sql: [string, string];
  reference: ReferenceDataPlan;
  candidateSha256: string;
  packageSha256: string;
}
export function createWriterPackage(snapshot: SchemaSnapshot): WriterPackage {
  const candidateSha256 = sha256(compileReconciliation(snapshot).join('\n'));
  const sql = compileProductionReconciliation(snapshot);
  const reference = createReferenceDataPlan(snapshot, candidateSha256, 5000);
  const packageSha256 = sha256(JSON.stringify({ version: 1, project: BACKUP_PROJECT,
    snapshotSha256: sha256(JSON.stringify(snapshot)), candidateSha256,
    enumsSha256: sha256(sql[0]), schemaSha256: sha256(sql[1]), referenceChecksum: reference.checksum }));
  return { snapshot, sql, reference, candidateSha256, packageSha256 };
}

export type WriterRecoveryMode = 'independent-key' | 'mac-only-initialization';

export interface WriterResumeFrom {
  approvalFile: string;
  approvalSha256: string;
  releaseSha: string;
  backupInventorySha256: string;
  enumsCatalogSha256: string;
}

export interface WriterApproval {
  format: 1;
  project: typeof BACKUP_PROJECT;
  approved: true;
  releaseSha: string;
  packageSha256: string;
  evidenceSha256: string;
  writerEvidenceFile: string;
  baselineCatalogSha256: string;
  backupId: string;
  archiveSha256: string;
  metadataSha256: string;
  recoveryEvidenceSha256: string;
  windowStart: string;
  windowEnd: string;
  reviewedBy: string;
  qualityChecksPassed: true;
  qualityRunId: number;
  maintenanceWindowConfirmed: true;
  enumCommitIsNotAtomicWithSchemaAcknowledged: true;
  managedAcceptanceStillRequired: true;
  sharedVpsRecoveryRiskAcknowledged: true;
  recoveryMode?: WriterRecoveryMode;
  macOnlyRecoveryRiskAcknowledged?: true;
  initialEmptyProductionOnly?: true;
  managedExtensionSha256?: string;
  resumeFrom?: WriterResumeFrom;
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WriterError('INVALID_WRITER_INPUT');
  return value as Record<string, unknown>;
}
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function writerRecoveryMode(approval: Pick<WriterApproval, 'recoveryMode' | 'macOnlyRecoveryRiskAcknowledged' | 'initialEmptyProductionOnly'>): WriterRecoveryMode {
  const mode = approval.recoveryMode === undefined ? 'independent-key' : approval.recoveryMode;
  if (mode === 'mac-only-initialization') {
    if (approval.macOnlyRecoveryRiskAcknowledged !== true || approval.initialEmptyProductionOnly !== true) {
      throw new WriterError('MAC_ONLY_INITIALIZATION_RISK_ACKNOWLEDGEMENT_REQUIRED');
    }
  } else if (mode !== 'independent-key' || approval.macOnlyRecoveryRiskAcknowledged !== undefined
    || approval.initialEmptyProductionOnly !== undefined) {
    throw new WriterError('INVALID_WRITER_RECOVERY_MODE');
  }
  return mode;
}
export function backupTime(id: unknown): number {
  if (typeof id !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(id)) throw new WriterError('INVALID_BACKUP_ID');
  const time = Date.parse(id.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z'));
  if (!Number.isFinite(time) || new Date(time).toISOString().replace(/[:.]/g, '-') !== id) throw new WriterError('INVALID_BACKUP_ID');
  return time;
}
export function requireWriterWindow(approval: WriterApproval, now: number): void {
  const start = Date.parse(approval.windowStart), end = Date.parse(approval.windowEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 60 * 60_000
    || now < start || now >= end) throw new WriterError('APPROVED_MIGRATION_WINDOW_REQUIRED');
  if (now < backupTime(approval.backupId) || now - backupTime(approval.backupId) > 2 * 60 * 60_000) {
    throw new WriterError('FRESH_BACKUP_REQUIRED');
  }
}

/** An operator-supplied review document, NOT an automatically issued approval. */
export function validateWriterApproval(
  value: unknown, bundle: WriterPackage, releaseSha: string, evidenceSha256: string, now = Date.now(),
): WriterApproval {
  const a = object(value);
  if (a.format !== 1 || a.project !== BACKUP_PROJECT || a.approved !== true
    || typeof releaseSha !== 'string' || !/^[a-f0-9]{40}$/.test(releaseSha) || a.releaseSha !== releaseSha
    || a.packageSha256 !== bundle.packageSha256 || a.evidenceSha256 !== evidenceSha256
    || typeof a.writerEvidenceFile !== 'string' || !/^production-reconciliation\.writer-rehearsal\.[0-9TZ-]+\.json$/.test(a.writerEvidenceFile)
    || !digest(a.evidenceSha256) || !['baselineCatalogSha256', 'archiveSha256', 'metadataSha256', 'recoveryEvidenceSha256'].every(key => digest(a[key]))
    || !['qualityChecksPassed', 'maintenanceWindowConfirmed', 'enumCommitIsNotAtomicWithSchemaAcknowledged',
      'managedAcceptanceStillRequired', 'sharedVpsRecoveryRiskAcknowledged'].every(key => a[key] === true)
    || typeof a.reviewedBy !== 'string' || !a.reviewedBy.trim() || a.reviewedBy.length > 160
    || !Number.isSafeInteger(a.qualityRunId) || Number(a.qualityRunId) < 1
    || typeof a.windowStart !== 'string' || typeof a.windowEnd !== 'string') throw new WriterError('REVIEWED_WRITER_APPROVAL_REQUIRED');
  // Every property above is checked, and backup/window are checked below.
  const approval = a as unknown as WriterApproval;
  if (a.managedExtensionSha256 !== undefined && !digest(a.managedExtensionSha256)) throw new WriterError('INVALID_MANAGED_EXTENSION_REVIEW');
  if (a.resumeFrom !== undefined) {
    const r = object(a.resumeFrom);
    if (typeof r.approvalFile !== 'string' || !/^approval(?:\.[0-9TZ-]+)?\.json$/.test(r.approvalFile)
      || !digest(r.approvalSha256) || !digest(r.backupInventorySha256) || !digest(r.enumsCatalogSha256)
      || typeof r.releaseSha !== 'string' || !/^[a-f0-9]{40}$/.test(r.releaseSha)
      || r.enumsCatalogSha256 !== a.baselineCatalogSha256) throw new WriterError('INVALID_REVIEWED_RESUME_BINDING');
  }
  writerRecoveryMode(approval);
  requireWriterWindow(approval, now);
  return approval;
}

export function requireWriterQualityRun(runValue: unknown, jobsValue: unknown, releaseSha: string): void {
  const run = object(runValue), jobs = object(jobsValue).jobs;
  if (run.head_sha !== releaseSha || run.head_branch !== 'main' || run.path !== '.github/workflows/quality.yml'
    || run.status !== 'completed' || run.conclusion !== 'success' || run.event !== 'push'
    || !Array.isArray(jobs) || !['backend-quality', 'frontend-quality'].every(name => jobs.some((value: unknown) => {
      const job = object(value); return job.name === name && job.status === 'completed' && job.conclusion === 'success';
    }))) throw new WriterError('EXACT_MAIN_RELEASE_QUALITY_RUN_REQUIRED');
}

export function validateWriterEvidence(value: unknown, bundle: WriterPackage): void {
  const r = object(value), checks = object(r.checks);
  if (r.status !== 'RECONCILIATION_WRITER_ISOLATED_PASSED' || r.packageSha256 !== bundle.packageSha256
    || r.productionChanged !== false || r.devDatabaseChanged !== false || r.cleanupVerified !== true
    || r.managedSupabaseIntegrationTested !== false || r.productionApproved !== false
    || !['legacyApply', 'fullCatalogVerified', 'referenceRows213', 'schemaAndReferenceRollback', 'enumRollback',
      'resumeAfterEnumCommit', 'repeatVerifiedNoop', 'driftRefused', 'nonemptyRefused', 'concurrentRefused',
      'commitUncertaintyReported', 'browserAndPrivateHistoryDenied', 'wrongIdentityRefused', 'unexpectedRelationRefused',
      'macOnlyInitialization', 'macOnlyNonemptyManagedRefused', 'managedOwnershipReproduced',
      'managedExtensionResume', 'resumeOriginalBindingsPreserved', 'resumeNewApprovalRequired',
      'resumeFreshBackupParity', 'managedExtensionDriftRefused', 'applicationRpcExposureRefused',
      'extensionMemberSpoofRefused', 'resumeRollback', 'resumeRepeatNoop', 'resumeCommitUncertainty'].every(key => checks[key] === true)) {
    throw new WriterError('WRITER_REHEARSAL_EVIDENCE_REQUIRED');
  }
}

/** Historical approval is immutable evidence, not permission to reuse its expired window. */
export function validateResumeApproval(originalRaw: string | undefined, approval: WriterApproval, bundle: WriterPackage): WriterApproval | undefined {
  if (!approval.resumeFrom) {
    if (originalRaw !== undefined) throw new WriterError('EXPLICIT_REVIEWED_RESUME_REQUIRED');
    return undefined;
  }
  if (originalRaw === undefined || sha256(originalRaw) !== approval.resumeFrom.approvalSha256) throw new WriterError('ORIGINAL_APPROVAL_CHECKSUM_MISMATCH');
  const value = object(JSON.parse(originalRaw) as unknown);
  const original = validateWriterApproval(value, bundle, approval.resumeFrom.releaseSha, String(value.evidenceSha256), Date.parse(String(value.windowStart)));
  if (original.resumeFrom !== undefined || original.backupId === approval.backupId
    || writerRecoveryMode(original) !== writerRecoveryMode(approval)) throw new WriterError('RESUME_REQUIRES_NEW_BACKUP_AND_SAME_RECOVERY_SCOPE');
  return original;
}

/** Evidence remains local/private. No decrypted backup or secret is in this document. */
export type RecoveryBinding = Pick<WriterApproval, 'backupId' | 'archiveSha256' | 'metadataSha256'
  | 'recoveryMode' | 'macOnlyRecoveryRiskAcknowledged' | 'initialEmptyProductionOnly'>;
export function validateWriterRecovery(value: unknown, approval: RecoveryBinding, now = Date.now()): void {
  const proof = object(value), receipt = object(proof.receipt), restore = object(proof.restore), copy = object(proof.copy);
  const archive = object(receipt.archive), metadata = object(receipt.metadata), checks = object(restore.checks);
  const key = object(proof.independentKeyRecovery);
  const mode = writerRecoveryMode(approval);
  if (receipt.project !== BACKUP_PROJECT || receipt.id !== approval.backupId || receipt.encrypted !== true
    || receipt.productionChanged !== false || archive.sha256 !== approval.archiveSha256 || metadata.sha256 !== approval.metadataSha256
    || restore.project !== BACKUP_PROJECT || restore.id !== approval.backupId || restore.status !== 'PUBLIC_APPLICATION_RESTORE_VERIFIED'
    || restore.archiveSha256 !== archive.sha256 || restore.productionChanged !== false
    || checks.tableRowsAndRlsMatch !== true || checks.columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch !== true || checks.publicExtensionsMatch !== true
    || copy.status !== 'ENCRYPTED_VPS_COPY_VERIFIED' || copy.project !== BACKUP_PROJECT || copy.id !== approval.backupId
    || copy.host !== '43.157.242.8' || copy.destination !== `/opt/sinegasi-backups/production/${approval.backupId}`
    || copy.directoryMode !== '0700' || copy.fileMode !== '0600' || copy.owner !== 'root'
    || copy.offDeviceBackupCopyVerified !== true || copy.decryptionKeyTransferred !== false || copy.databaseCredentialsTransferred !== false
    || copy.productionChanged !== false || copy.devCaddyUnchanged !== true
    || typeof copy.verifiedAt !== 'string' || Date.parse(copy.verifiedAt) < backupTime(approval.backupId) || Date.parse(copy.verifiedAt) > now) {
    throw new WriterError('VERIFIED_BACKUP_RESTORE_AND_VPS_COPY_REQUIRED');
  }
  if (mode === 'mac-only-initialization') {
    // Explicitly record the unavailable independent key; never manufacture a recovery attestation.
    // Current Mac-key availability is checked by decrypting backup metadata in the CLI.
    if (key.verified !== false || key.sameDeviceAsMac !== true || key.sameHostAsApplication !== false
      || key.medium !== 'macOS login Keychain only') throw new WriterError('HONEST_MAC_ONLY_KEY_CUSTODY_REQUIRED');
  } else if (key.verified !== true || key.sameHostAsApplication !== false || key.sameDeviceAsMac !== false
    || typeof key.medium !== 'string' || !key.medium.trim() || key.medium.length > 200
    || typeof key.verifiedBy !== 'string' || !key.verifiedBy.trim()
    || typeof key.verifiedAt !== 'string' || !Number.isFinite(Date.parse(key.verifiedAt)) || Date.parse(key.verifiedAt) > now) {
    throw new WriterError('VERIFIED_BACKUP_AND_INDEPENDENT_KEY_RECOVERY_REQUIRED');
  }
  if (!Number.isFinite(Date.parse(String(copy.verifiedAt))) || !Number.isSafeInteger(archive.bytes) || Number(archive.bytes) < 100
    || !Number.isSafeInteger(metadata.bytes) || Number(metadata.bytes) < 100) throw new WriterError('BACKUP_COPY_CHECKSUM_MISMATCH');
  const files = copy.files;
  if (!Array.isArray(files) || ![['database.dump.age', archive], ['metadata.json.age', metadata]].every(([name, expected]) => {
    const e = object(expected);
    return files.some((file: unknown) => { const f = object(file); return f.name === name && f.sha256 === e.sha256 && f.bytes === e.bytes; });
  })) throw new WriterError('BACKUP_COPY_CHECKSUM_MISMATCH');
}

export type WriterOptions = { mode: 'plan' } | { mode: 'apply' | 'resume'; approval: string; confirmedSha256: string };
export function parseWriterOptions(args: readonly string[]): WriterOptions {
  if (args.length === 1 && args[0] === 'plan') return { mode: 'plan' };
  if (args.length === 5 && (args[0] === 'apply' || args[0] === 'resume') && args[1] === '--approval' && args[3] === '--confirm-approval'
    && args[2].startsWith('/') && !args[2].includes('\0') && digest(args[4])) {
    return { mode: args[0], approval: args[2], confirmedSha256: args[4] };
  }
  throw new WriterError('USE_PLAN_OR_EXPLICIT_APPROVAL_ONLY');
}
