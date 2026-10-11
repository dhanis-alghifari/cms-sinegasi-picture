/** Synthetic authorization for tests on network-none disposable PostgreSQL ONLY.
 * Never reads Keychain, a live connection URL or any production backup.
 */
import type { DatabaseInventory } from './productionBackupCore.js';
import { sha256 } from './productionReconciliation.js';
import type { WriterAuthorization } from './reconciliationWriterCore.js';
import type { WriterPackage } from './reconciliationWriterPolicy.js';

export const WRITER_CHECKS = ['legacyApply', 'fullCatalogVerified', 'referenceRows213', 'schemaAndReferenceRollback', 'enumRollback',
  'resumeAfterEnumCommit', 'repeatVerifiedNoop', 'driftRefused', 'nonemptyRefused', 'concurrentRefused',
  'commitUncertaintyReported', 'browserAndPrivateHistoryDenied', 'wrongIdentityRefused', 'unexpectedRelationRefused',
  'macOnlyInitialization', 'macOnlyNonemptyManagedRefused', 'managedOwnershipReproduced',
  'managedExtensionResume', 'resumeOriginalBindingsPreserved', 'resumeNewApprovalRequired',
  'resumeFreshBackupParity', 'managedExtensionDriftRefused', 'applicationRpcExposureRefused',
  'extensionMemberSpoofRefused', 'resumeRollback', 'resumeRepeatNoop', 'resumeCommitUncertainty'] as const;
export function writerFixtureAuthorization(bundle: WriterPackage, inventory: DatabaseInventory, catalogHash: string, now: number): WriterAuthorization {
  const id = new Date(now - 60_000).toISOString().replace(/[:.]/g, '-');
  const archive = { sha256: 'a'.repeat(64), bytes: 1024 }, metadata = { sha256: 'b'.repeat(64), bytes: 1024 };
  const recovery = { receipt: { project: 'pvbdiftvzoeelibxlxzb', id, encrypted: true, productionChanged: false, archive, metadata },
    restore: { project: 'pvbdiftvzoeelibxlxzb', id, status: 'PUBLIC_APPLICATION_RESTORE_VERIFIED', archiveSha256: archive.sha256, productionChanged: false,
      checks: { tableRowsAndRlsMatch: true, columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch: true, publicExtensionsMatch: true } },
    copy: { status: 'ENCRYPTED_VPS_COPY_VERIFIED', project: 'pvbdiftvzoeelibxlxzb', id, verifiedAt: new Date(now).toISOString(),
      host: '43.157.242.8', destination: `/opt/sinegasi-backups/production/${id}`, directoryMode: '0700', fileMode: '0600', owner: 'root',
      offDeviceBackupCopyVerified: true, decryptionKeyTransferred: false, databaseCredentialsTransferred: false, productionChanged: false,
      devCaddyUnchanged: true, files: [{ name: 'database.dump.age', ...archive }, { name: 'metadata.json.age', ...metadata }] },
    independentKeyRecovery: { verified: true, medium: 'ISOLATED SYNTHETIC TEST ONLY', verifiedBy: 'test fixture',
      sameDeviceAsMac: false, sameHostAsApplication: false, verifiedAt: new Date(now).toISOString() } };
  const evidence = { status: 'RECONCILIATION_WRITER_ISOLATED_PASSED', packageSha256: bundle.packageSha256,
    productionChanged: false, devDatabaseChanged: false, cleanupVerified: true, managedSupabaseIntegrationTested: false,
    productionApproved: false, checks: Object.fromEntries(WRITER_CHECKS.map(key => [key, true])) };
  const evidenceRaw = JSON.stringify(evidence), recoveryRaw = JSON.stringify(recovery), releaseSha = '1'.repeat(40);
  const approvalRaw = JSON.stringify({ format: 1, project: 'pvbdiftvzoeelibxlxzb', approved: true, isolatedFixture: true,
    releaseSha, packageSha256: bundle.packageSha256, evidenceSha256: sha256(evidenceRaw), baselineCatalogSha256: catalogHash,
    writerEvidenceFile: 'production-reconciliation.writer-rehearsal.2026-10-11T09-00-00-000Z.json',
    backupId: id, archiveSha256: archive.sha256, metadataSha256: metadata.sha256, recoveryEvidenceSha256: sha256(recoveryRaw),
    windowStart: new Date(now - 1000).toISOString(), windowEnd: new Date(now + 30 * 60_000).toISOString(), reviewedBy: 'ISOLATED TEST FIXTURE',
    qualityChecksPassed: true, qualityRunId: 1, maintenanceWindowConfirmed: true, enumCommitIsNotAtomicWithSchemaAcknowledged: true,
    managedAcceptanceStillRequired: true, sharedVpsRecoveryRiskAcknowledged: true });
  return { releaseSha, approvalRaw, confirmedApprovalSha256: sha256(approvalRaw), evidenceRaw, recoveryRaw, backupInventory: inventory };
}

/** Synthetic Mac-only risk acceptance; still never a live operator approval. */
export function writerMacOnlyFixture(auth: WriterAuthorization): WriterAuthorization {
  const recovery: unknown = JSON.parse(auth.recoveryRaw);
  const approval: unknown = JSON.parse(auth.approvalRaw);
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)
    || !approval || typeof approval !== 'object' || Array.isArray(approval)) throw new Error('INVALID_TEST_AUTHORIZATION');
  const recoveryRaw = JSON.stringify({ ...recovery, independentKeyRecovery: {
    verified: false, sameDeviceAsMac: true, sameHostAsApplication: false, medium: 'macOS login Keychain only',
  } });
  const approvalRaw = JSON.stringify({ ...approval, recoveryMode: 'mac-only-initialization',
    macOnlyRecoveryRiskAcknowledged: true, initialEmptyProductionOnly: true, recoveryEvidenceSha256: sha256(recoveryRaw) });
  return { ...auth, recoveryRaw, approvalRaw, confirmedApprovalSha256: sha256(approvalRaw) };
}

/** New synthetic authorization that links an immutable previous enum run. */
export function writerResumeFixture(bundle: WriterPackage, original: WriterAuthorization, inventory: DatabaseInventory,
  catalogHash: string, managedExtensionSha256: string, now: number): WriterAuthorization {
  const oldApproval = JSON.parse(original.approvalRaw) as Record<string, unknown>;
  const initial = writerFixtureAuthorization(bundle, inventory, catalogHash, now);
  const fresh = oldApproval.recoveryMode === 'mac-only-initialization' ? writerMacOnlyFixture(initial) : initial;
  const approvalRaw = JSON.stringify({ ...JSON.parse(fresh.approvalRaw) as Record<string, unknown>, releaseSha: '2'.repeat(40),
    managedExtensionSha256, resumeFrom: { approvalFile: 'approval.2026-10-11T09-00-00-000Z.json',
      approvalSha256: sha256(original.approvalRaw), releaseSha: original.releaseSha,
      backupInventorySha256: sha256(JSON.stringify(original.backupInventory)), enumsCatalogSha256: catalogHash },
    recoveryMode: oldApproval.recoveryMode });
  return { ...fresh, releaseSha: '2'.repeat(40), approvalRaw, confirmedApprovalSha256: sha256(approvalRaw), originalApprovalRaw: original.approvalRaw };
}
