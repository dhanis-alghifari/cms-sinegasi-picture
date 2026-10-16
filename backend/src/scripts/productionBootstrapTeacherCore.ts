import path from 'node:path';
import { bootstrapFirstTeacher, BootstrapTeacherError, validateBootstrapTeacherOptions,
  type BootstrapCredentialStore, type BootstrapTeacherResult } from './bootstrapTeacherCore.js';
import { BACKUP_PROJECT, quoteIdentifier, type DatabaseInventory } from './productionBackupCore.js';
import { sha256 } from './productionReconciliation.js';
import { verifyReferenceRows } from './productionReferenceData.js';
import { readWriterCatalog, verifyWriterTarget, writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';
import { backupTime, createWriterPackage, object, validateWriterRecovery, type RecoveryBinding,
  type WriterPackage, writerRecoveryMode } from './reconciliationWriterPolicy.js';

export const BOOTSTRAP_GUARD_CHECKS = ['completedCheckpoint', 'enumOnlyRefused', 'catalogDriftRefused',
  'backupParityRefused', 'privateHistoryDenied', 'concurrentWriterRefused', 'oneTeacherCanonicalAudit',
  'rollbackBeforeCommit', 'repeatRefused', 'commitUncertaintyPreservesCredentials'] as const;
export const MANAGED_BOOTSTRAP_CHECKS = ['SERVICE_ROLE_APPLICATION_TABLES_AND_VIEWS_READ',
  'SERVICE_ROLE_MIGRATION_JOURNALS_DENIED', 'CANONICAL_CONFIGURATION_REST_MATCH', 'THREE_READ_ONLY_RPC_CONTRACTS',
  'ANON_ALL_TABLES_VIEWS_AND_THREE_RPCS_DENIED', 'INITIAL_TABLE_COUNTS_UNCHANGED',
  'REAL_APPLICATION_HEALTH_WITH_WORKERS_DISABLED', 'APPLICATION_AUTHORITATIVE_USER_READ_NO_MOCK',
  'APPLICATION_ACCESS_MATRIX_REAL_REPOSITORY'] as const;

export interface ProductionBootstrapApproval extends RecoveryBinding {
  format: 1;
  operation: 'bootstrap_first_teacher';
  project: typeof BACKUP_PROJECT;
  approved: true;
  releaseSha: string;
  runnerSourceSha256: string;
  packageSha256: string;
  targetCatalogSha256: string;
  migrationApprovalSha256: string;
  managedExtensionSha256: string;
  integrationEvidenceFile: string;
  integrationEvidenceSha256: string;
  rehearsalEvidenceFile: string;
  rehearsalEvidenceSha256: string;
  recoveryEvidenceSha256: string;
  username: string;
  nama: string;
  credentialFile: string;
  windowStart: string;
  windowEnd: string;
  reviewedBy: string;
  qualityRunId: number;
  maintenanceWindowConfirmed: true;
  sharedVpsRecoveryRiskAcknowledged: true;
  firstTeacherOnlyAcknowledged: true;
  noDeploymentAuthorized: true;
}
export interface BootstrapReviewBindings {
  releaseSha: string;
  runnerSourceSha256: string;
  integrationSourceSha256: string;
  schemaPackageSha256: string;
  referenceChecksum: string;
}
export interface ProductionBootstrapAuthorization extends BootstrapReviewBindings {
  approvalRaw: string;
  confirmedApprovalSha256: string;
  integrationRaw: string;
  rehearsalRaw: string;
  recoveryRaw: string;
  backupInventory: DatabaseInventory;
}
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function reject(code: string): never { throw new BootstrapTeacherError(code); }

export function requireBootstrapWindow(a: ProductionBootstrapApproval, now: number): void {
  const start = Date.parse(a.windowStart), end = Date.parse(a.windowEnd), backup = backupTime(a.backupId);
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end)
    || end <= start || end - start > 60 * 60_000 || now < start || now >= end) reject('BOOTSTRAP_APPROVED_WINDOW_REQUIRED');
  if (backup > now || now - backup > 2 * 60 * 60_000) reject('BOOTSTRAP_FRESH_BACKUP_REQUIRED');
}

/** A new, checksum-bound operator approval. Migration approvals are never reused. */
export function validateProductionBootstrapApproval(value: unknown, bundle: WriterPackage,
  bindings: BootstrapReviewBindings, now: number): ProductionBootstrapApproval {
  const a = object(value);
  if (a.format !== 1 || a.operation !== 'bootstrap_first_teacher' || a.project !== BACKUP_PROJECT || a.approved !== true
    || a.isolatedFixture !== undefined || !/^[a-f0-9]{40}$/.test(bindings.releaseSha) || a.releaseSha !== bindings.releaseSha
    || !digest(bindings.runnerSourceSha256) || a.runnerSourceSha256 !== bindings.runnerSourceSha256
    || a.packageSha256 !== bundle.packageSha256
    || !['targetCatalogSha256', 'migrationApprovalSha256', 'managedExtensionSha256', 'integrationEvidenceSha256',
      'rehearsalEvidenceSha256', 'recoveryEvidenceSha256', 'archiveSha256', 'metadataSha256'].every(key => digest(a[key]))
    || !['maintenanceWindowConfirmed', 'sharedVpsRecoveryRiskAcknowledged', 'firstTeacherOnlyAcknowledged',
      'noDeploymentAuthorized'].every(key => a[key] === true)
    || typeof a.reviewedBy !== 'string' || !a.reviewedBy.trim() || a.reviewedBy.length > 160
    || /[\u0000-\u001f\u007f]/u.test(a.reviewedBy) || !Number.isSafeInteger(a.qualityRunId) || Number(a.qualityRunId) < 1
    || typeof a.username !== 'string' || typeof a.nama !== 'string' || typeof a.windowStart !== 'string' || typeof a.windowEnd !== 'string'
    || typeof a.integrationEvidenceFile !== 'string' || !/^production-managed-integration\.read-only\.[0-9TZ-]+\.json$/.test(a.integrationEvidenceFile)
    || typeof a.rehearsalEvidenceFile !== 'string' || !/^production-bootstrap\.rehearsal\.[0-9TZ-]+\.json$/.test(a.rehearsalEvidenceFile)
    || typeof a.credentialFile !== 'string' || !path.isAbsolute(a.credentialFile) || path.normalize(a.credentialFile) !== a.credentialFile
    || path.extname(a.credentialFile) !== '.json' || /[\u0000-\u001f\u007f]/u.test(a.credentialFile)) {
    reject('REVIEWED_BOOTSTRAP_APPROVAL_REQUIRED');
  }
  const approval = a as unknown as ProductionBootstrapApproval;
  validateBootstrapTeacherOptions({ projectRef: approval.project, username: approval.username, nama: approval.nama, apply: true,
    confirmProject: approval.project });
  requireBootstrapWindow(approval, now);
  writerRecoveryMode(approval);
  return approval;
}

export function validateBootstrapEvidence(auth: Omit<ProductionBootstrapAuthorization, 'backupInventory'>, a: ProductionBootstrapApproval,
  bundle: WriterPackage, now: number): void {
  if (sha256(auth.integrationRaw) !== a.integrationEvidenceSha256 || sha256(auth.rehearsalRaw) !== a.rehearsalEvidenceSha256
    || sha256(auth.recoveryRaw) !== a.recoveryEvidenceSha256) reject('BOOTSTRAP_EVIDENCE_CHECKSUM_MISMATCH');
  const integration = object(JSON.parse(auth.integrationRaw) as unknown), requests = object(integration.requests);
  const integrationChecks = integration.checks;
  const observed = Date.parse(String(integration.observedAt));
  if (integration.status !== 'MANAGED_SUPABASE_READ_ONLY_INTEGRATION_PASSED' || integration.project !== BACKUP_PROJECT
    || integration.releaseSha !== auth.releaseSha || integration.workingTreeDirty !== false
    || integration.sourceSha256 !== auth.integrationSourceSha256 || !digest(auth.integrationSourceSha256)
    || integration.schemaPackageSha256 !== auth.schemaPackageSha256 || !digest(auth.schemaPackageSha256)
    || integration.referenceChecksum !== auth.referenceChecksum || !digest(auth.referenceChecksum)
    || !Array.isArray(integrationChecks) || integrationChecks.length !== MANAGED_BOOTSTRAP_CHECKS.length
    || new Set(integrationChecks).size !== integrationChecks.length
    || MANAGED_BOOTSTRAP_CHECKS.some(key => !integrationChecks.includes(key))
    || requests.blocked !== 0 || !Number.isSafeInteger(requests.sent) || Number(requests.sent) < 1
    || !Number.isFinite(observed) || observed > backupTime(a.backupId) || now - observed > 24 * 60 * 60_000
    || integration.managedDataApiReadsTested !== true || integration.applicationReadAdaptersTested !== true
    || !['productionChanged', 'accountCreated', 'workersStarted', 'deploymentPerformed', 'readyForPublicLaunch'].every(key => integration[key] === false)) {
    reject('BOOTSTRAP_MANAGED_READ_EVIDENCE_REQUIRED');
  }
  // Historical dirty-tree receipts remain diagnostic only. A NEW private receipt
  // must bind the exact clean release whose successful main CI the CLI verifies.
  const rehearsal = object(JSON.parse(auth.rehearsalRaw) as unknown), checks = object(rehearsal.checks);
  if (rehearsal.status !== 'BOOTSTRAP_GUARD_ISOLATED_PASSED' || rehearsal.packageSha256 !== bundle.packageSha256
    || rehearsal.runnerSourceSha256 !== auth.runnerSourceSha256 || rehearsal.cleanupVerified !== true
    || !['productionChanged', 'devDatabaseChanged', 'productionApproved', 'managedSupabaseIntegrationTested'].every(key => rehearsal[key] === false)
    || BOOTSTRAP_GUARD_CHECKS.some(key => checks[key] !== true)) reject('BOOTSTRAP_ISOLATED_REHEARSAL_REQUIRED');
  validateWriterRecovery(JSON.parse(auth.recoveryRaw) as unknown, a, now);
}

export async function requireCompletedBootstrapCheckpoint(db: WriterSession, bundle: WriterPackage): Promise<{
  targetCatalogSha256: string; migrationApprovalSha256: string;
}> {
  const state = (await db.query("SELECT to_regclass('sinegasi_ops.production_reconciliation_runs') IS NOT NULL AS present")).rows[0];
  if (state?.present !== true) reject('BOOTSTRAP_COMPLETED_MIGRATION_REQUIRED');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const access = (await db.query(`SELECT has_schema_privilege($1,'sinegasi_ops','USAGE') AS usage,
      has_schema_privilege($1,'sinegasi_ops','CREATE') AS create,
      has_table_privilege($1,'sinegasi_ops.production_reconciliation_runs','SELECT,INSERT,UPDATE,DELETE') AS access`, [role])).rows[0];
    if (!access || Object.values(access).some(value => value !== false)) reject('BOOTSTRAP_PRIVATE_HISTORY_EXPOSED');
  }
  const rows = (await db.query(`SELECT package_sha256,stage,target_catalog_sha256,approval_sha256,
    to_jsonb(r)->'completion_authorization' AS completion_authorization
    FROM sinegasi_ops.production_reconciliation_runs r`)).rows;
  if (rows.length !== 1 || rows[0].stage !== 'complete' || rows[0].package_sha256 !== bundle.packageSha256
    || !digest(rows[0].target_catalog_sha256) || !digest(rows[0].approval_sha256)) reject('BOOTSTRAP_COMPLETED_MIGRATION_REQUIRED');
  const run = rows[0];
  let migrationApprovalSha256 = String(run.approval_sha256);
  if (run.completion_authorization !== null && run.completion_authorization !== undefined) {
    const completion = object(run.completion_authorization);
    if (Object.keys(completion).length !== 3 || !digest(completion.approvalSha256) || !digest(completion.backupInventorySha256)
      || typeof completion.releaseSha !== 'string' || !/^[a-f0-9]{40}$/.test(completion.releaseSha)) reject('BOOTSTRAP_COMPLETION_BINDING_INVALID');
    migrationApprovalSha256 = completion.approvalSha256;
  }
  return { targetCatalogSha256: String(run.target_catalog_sha256), migrationApprovalSha256 };
}

/** No SQL package is applied here. This creates ONE first account, under the
 * same migration lock and table locks, with evidence checked before credentials. */
export async function bootstrapApprovedProductionTeacher(db: WriterSession, credentials: BootstrapCredentialStore,
  bundle: WriterPackage, auth: ProductionBootstrapAuthorization, now: () => number = Date.now): Promise<BootstrapTeacherResult> {
  if (JSON.stringify(createWriterPackage(bundle.snapshot)) !== JSON.stringify(bundle)) reject('BOOTSTRAP_PACKAGE_TAMPERED');
  if (sha256(auth.approvalRaw) !== auth.confirmedApprovalSha256) reject('BOOTSTRAP_APPROVAL_CHECKSUM_MISMATCH');
  const approval = validateProductionBootstrapApproval(JSON.parse(auth.approvalRaw) as unknown, bundle, auth, now());
  validateBootstrapEvidence(auth, approval, bundle, now());
  let baselineHash: string | undefined, pid: unknown;
  const identity = async () => {
    const info = (await db.query(`SELECT current_database() AS database,current_user AS actor,pg_backend_pid() AS pid,
      current_setting('server_version_num') AS version,current_setting('transaction_read_only') AS "readOnly"`)).rows[0];
    if (!info || info.database !== 'postgres' || info.actor !== 'postgres' || !/^17[0-9]{4}$/.test(String(info.version))
      || info.readOnly !== 'off' || !Number.isInteger(info.pid) || (pid !== undefined && pid !== info.pid)) reject('BOOTSTRAP_SESSION_IDENTITY_REQUIRED');
    pid = info.pid;
  };
  return bootstrapFirstTeacher({ projectRef: approval.project, username: approval.username, nama: approval.nama,
    apply: true, confirmProject: approval.project }, {
    database: db, credentials,
    async beforeCreate() {
      requireBootstrapWindow(approval, now());
      await db.query("SET LOCAL search_path=pg_catalog,public,extensions; SET LOCAL idle_in_transaction_session_timeout='30s'");
      if ((await db.query("SELECT pg_try_advisory_xact_lock(hashtext('sinegasi:schema-migrations')) AS acquired")).rows[0]?.acquired !== true) {
        reject('BOOTSTRAP_CONCURRENT_WRITER_REFUSED');
      }
      await db.query(`LOCK TABLE ${bundle.snapshot.tables.map(t => 'public.' + quoteIdentifier(t.relname)).sort().join(',')}
        IN SHARE ROW EXCLUSIVE MODE`);
      await db.query('LOCK TABLE auth.users, storage.objects IN SHARE MODE');
      await db.query('LOCK TABLE sinegasi_ops.production_reconciliation_runs IN SHARE MODE');
      await identity();
      const completed = await requireCompletedBootstrapCheckpoint(db, bundle);
      if (completed.targetCatalogSha256 !== approval.targetCatalogSha256
        || completed.migrationApprovalSha256 !== approval.migrationApprovalSha256) reject('BOOTSTRAP_CHECKPOINT_BINDING_MISMATCH');
      const catalog = await verifyWriterTarget(db, bundle.snapshot, bundle.reference, approval.managedExtensionSha256);
      baselineHash = writerCatalogHash(catalog);
      if (baselineHash !== completed.targetCatalogSha256) reject('BOOTSTRAP_CATALOG_DRIFT_REFUSED');
      if (sha256(JSON.stringify(catalog.inventory)) !== sha256(JSON.stringify(auth.backupInventory))) reject('BOOTSTRAP_POST_MIGRATION_BACKUP_PARITY_REQUIRED');
      const counts = (await db.query(`SELECT (SELECT count(*)::text FROM auth.users) AS "authAccounts",
        (SELECT count(*)::text FROM storage.objects) AS "storageObjects"`)).rows[0];
      if (counts?.authAccounts !== '0' || counts.storageObjects !== '0') reject('BOOTSTRAP_INITIAL_EMPTY_MANAGED_DATA_REQUIRED');
    },
    async beforeCommit() {
      requireBootstrapWindow(approval, now());
      await identity();
      await verifyReferenceRows(db, bundle.reference);
      const catalog = await readWriterCatalog(db);
      if (catalog.inventory.tables.find(t => t.name === 'users')?.rows !== '1'
        || catalog.inventory.tables.find(t => t.name === 'activity_logs')?.rows !== '1') reject('BOOTSTRAP_UNEXPECTED_ACCOUNT_OR_AUDIT_COUNT');
      const restored = { ...catalog, inventory: { ...catalog.inventory, tables: catalog.inventory.tables.map(t =>
        t.name === 'users' || t.name === 'activity_logs' ? { ...t, rows: '0' } : t) } };
      if (writerCatalogHash(restored) !== baselineHash) reject('BOOTSTRAP_UNEXPECTED_CATALOG_OR_DATA_CHANGE');
      requireBootstrapWindow(approval, now());
    },
  });
}
