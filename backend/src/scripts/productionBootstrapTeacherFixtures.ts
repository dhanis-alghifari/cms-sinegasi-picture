/** Synthetic evidence for marked, network-none disposable PostgreSQL and unit
 * tests only. Never imported by the production CLI or persisted as operator approval. */
import { writerMacOnlyFixture, writerFixtureAuthorization } from './reconciliationWriterFixtures.js';
import { writerCatalogHash, type WriterCatalog } from './reconciliationWriterCatalog.js';
import { sha256 } from './productionReconciliation.js';
import type { WriterPackage } from './reconciliationWriterPolicy.js';
import { BOOTSTRAP_GUARD_CHECKS, MANAGED_BOOTSTRAP_CHECKS, type ProductionBootstrapAuthorization } from './productionBootstrapTeacherCore.js';

export function bootstrapFixtureAuthorization(bundle: WriterPackage, catalog: WriterCatalog,
  migrationApprovalSha256: string, managedExtensionSha256: string, now: number): ProductionBootstrapAuthorization {
  const recovery = writerMacOnlyFixture(writerFixtureAuthorization(bundle, catalog.inventory, writerCatalogHash(catalog), now));
  const old = JSON.parse(recovery.approvalRaw) as Record<string, unknown>;
  const releaseSha = '1'.repeat(40), runnerSourceSha256 = 'a'.repeat(64), integrationSourceSha256 = 'b'.repeat(64);
  const schemaPackageSha256 = 'c'.repeat(64), referenceChecksum = 'd'.repeat(64);
  const integrationRaw = JSON.stringify({ status: 'MANAGED_SUPABASE_READ_ONLY_INTEGRATION_PASSED',
    observedAt: new Date(now - 120_000).toISOString(), project: 'pvbdiftvzoeelibxlxzb', releaseSha, workingTreeDirty: false,
    sourceSha256: integrationSourceSha256, schemaPackageSha256, referenceChecksum, checks: MANAGED_BOOTSTRAP_CHECKS,
    requests: { sent: 232, blocked: 0 }, managedDataApiReadsTested: true, applicationReadAdaptersTested: true,
    productionChanged: false, accountCreated: false, workersStarted: false, deploymentPerformed: false, readyForPublicLaunch: false });
  const rehearsalRaw = JSON.stringify({ status: 'BOOTSTRAP_GUARD_ISOLATED_PASSED', packageSha256: bundle.packageSha256,
    runnerSourceSha256, cleanupVerified: true, productionChanged: false, devDatabaseChanged: false,
    productionApproved: false, managedSupabaseIntegrationTested: false,
    checks: Object.fromEntries(BOOTSTRAP_GUARD_CHECKS.map(key => [key, true])) });
  const approvalRaw = JSON.stringify({ format: 1, operation: 'bootstrap_first_teacher', project: 'pvbdiftvzoeelibxlxzb', approved: true,
    releaseSha, runnerSourceSha256, packageSha256: bundle.packageSha256, targetCatalogSha256: writerCatalogHash(catalog),
    migrationApprovalSha256, managedExtensionSha256, integrationEvidenceSha256: sha256(integrationRaw),
    integrationEvidenceFile: 'production-managed-integration.read-only.2026-10-11T16-13-51-803Z.json',
    rehearsalEvidenceSha256: sha256(rehearsalRaw), rehearsalEvidenceFile: 'production-bootstrap.rehearsal.2026-10-11T16-00-00-000Z.json',
    recoveryEvidenceSha256: sha256(recovery.recoveryRaw), backupId: old.backupId, archiveSha256: old.archiveSha256,
    metadataSha256: old.metadataSha256, recoveryMode: 'mac-only-initialization', macOnlyRecoveryRiskAcknowledged: true,
    initialEmptyProductionOnly: true, username: 'fixture.teacher', nama: 'ISOLATED TEST ONLY', credentialFile: '/tmp/private-test/teacher.json',
    windowStart: new Date(now - 1000).toISOString(), windowEnd: new Date(now + 30 * 60_000).toISOString(),
    reviewedBy: 'ISOLATED TEST ONLY', qualityRunId: 1, maintenanceWindowConfirmed: true,
    sharedVpsRecoveryRiskAcknowledged: true, firstTeacherOnlyAcknowledged: true, noDeploymentAuthorized: true });
  return { releaseSha, runnerSourceSha256, integrationSourceSha256, schemaPackageSha256, referenceChecksum,
    approvalRaw, confirmedApprovalSha256: sha256(approvalRaw), integrationRaw, rehearsalRaw,
    recoveryRaw: recovery.recoveryRaw, backupInventory: catalog.inventory };
}
