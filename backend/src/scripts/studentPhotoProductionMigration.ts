import { DeploymentGateError } from './productionDeploymentError.js';
import { DEPLOYMENT_PROJECT, readDeploymentCatalog, requireDeploymentObservation, requireDeploymentWindow,
  validateDeploymentEvidence, type DeploymentEvidence, type DeploymentGateContext } from './productionDeploymentGate.js';
import { quoteIdentifier } from './productionBackupCore.js';
import { readWriterCatalog, writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';
import { createWriterPackage, type WriterPackage } from './reconciliationWriterPolicy.js';
import { STUDENT_PHOTO_CHANGE, STUDENT_PHOTO_SQL_SHA256, readStudentPhotoSql, requireStudentPhotoAbsent,
  studentPhotoHash, type StudentPhotoReceipt } from './studentPhotoProductionPolicy.js';
import { DEPLOYMENT_OWNER } from './productionDeploymentReview.js';

export interface StudentPhotoApproval {
  format: 1;
  operation: typeof STUDENT_PHOTO_CHANGE;
  project: typeof DEPLOYMENT_PROJECT;
  releaseSha: string;
  sqlSha256: typeof STUDENT_PHOTO_SQL_SHA256;
  baselineEvidenceSha256: string;
  rehearsalSha256: string;
  qualityRunId: number;
  approvedBy: string;
  windowStart: string;
  windowEnd: string;
  maintenanceWindowConfirmed: true;
  noOtherWriters: true;
  databaseRollbackCompatible: true;
  noDeploymentAuthorized: true;
}
export interface StudentPhotoAuthorization {
  approvalRaw: string;
  confirmApproval: string;
  baselineRaw: string;
  rehearsalRaw: string;
  context: Omit<DeploymentGateContext, 'now'>;
}
function requireMigration(condition: unknown, code: string): asserts condition {
  if (!condition) throw new DeploymentGateError(code);
}
export function validateStudentPhotoApproval(auth: StudentPhotoAuthorization, now: number): {
  approval: StudentPhotoApproval; baseline: DeploymentEvidence;
} {
  requireMigration(/^[a-f0-9]{64}$/.test(auth.confirmApproval) && auth.approvalRaw.length <= 8192
    && studentPhotoHash(auth.approvalRaw) === auth.confirmApproval, 'PHOTO_MIGRATION_APPROVAL_CHECKSUM_MISMATCH');
  const a: unknown = JSON.parse(auth.approvalRaw);
  requireMigration(a !== null && typeof a === 'object' && !Array.isArray(a), 'PHOTO_MIGRATION_APPROVAL_REQUIRED');
  const item = a as Record<string, unknown>;
  const keys = ['format', 'operation', 'project', 'releaseSha', 'sqlSha256', 'baselineEvidenceSha256', 'rehearsalSha256', 'qualityRunId',
    'approvedBy', 'windowStart', 'windowEnd', 'maintenanceWindowConfirmed', 'noOtherWriters',
    'databaseRollbackCompatible', 'noDeploymentAuthorized'];
  requireMigration(JSON.stringify(item) === auth.approvalRaw && Object.keys(item).length === keys.length
    && keys.every(key => Object.hasOwn(item, key)) && item.format === 1 && item.operation === STUDENT_PHOTO_CHANGE
    && item.project === DEPLOYMENT_PROJECT && item.releaseSha === auth.context.releaseSha
    && item.sqlSha256 === STUDENT_PHOTO_SQL_SHA256 && item.baselineEvidenceSha256 === auth.context.evidenceSha256
    && typeof item.rehearsalSha256 === 'string' && /^[a-f0-9]{64}$/.test(item.rehearsalSha256)
    && auth.rehearsalRaw.length <= 8192 && studentPhotoHash(auth.rehearsalRaw) === item.rehearsalSha256
    && Number.isSafeInteger(item.qualityRunId) && Number(item.qualityRunId) > 0
    && item.approvedBy === DEPLOYMENT_OWNER
    && typeof item.windowStart === 'string' && typeof item.windowEnd === 'string'
    && ['maintenanceWindowConfirmed', 'noOtherWriters', 'databaseRollbackCompatible', 'noDeploymentAuthorized']
      .every(key => item[key] === true), 'PHOTO_MIGRATION_EXACT_APPROVAL_REQUIRED');
  const baseline = validateDeploymentEvidence(auth.baselineRaw, { ...auth.context, now });
  requireMigration(baseline.format === 2, 'PHOTO_MIGRATION_PRECHANGE_BASELINE_REQUIRED');
  // A local checksum is NOT proof that an independent reviewer approved a run.
  // Do not silently downgrade independent-review to owner attestation.
  requireMigration(baseline.reviewPolicy.mode === 'solo-owner' && item.approvedBy === baseline.reviewPolicy.owner,
    'PHOTO_MIGRATION_EXPLICIT_SOLO_OWNER_REQUIRED');
  const rehearsal: unknown = JSON.parse(auth.rehearsalRaw);
  requireMigration(rehearsal !== null && typeof rehearsal === 'object' && !Array.isArray(rehearsal), 'PHOTO_MIGRATION_REHEARSAL_REQUIRED');
  const r = rehearsal as Record<string, unknown>;
  const rehearsalKeys = ['status', 'releaseSha', 'sqlSha256', 'guardQualityRunId', 'postgresMajor', 'verifiedAt',
    'cleanupVerified', 'productionChanged', 'devDatabaseChanged', 'checks'];
  const checks = ['legacyFailureReproduced', 'auditedUpdatePassed', 'invalidActorReasonRefused',
    'auditFailureRollsBack', 'contextRestored', 'publicExecuteDenied'];
  const verified = typeof r.verifiedAt === 'string' ? Date.parse(r.verifiedAt) : NaN;
  requireMigration(Object.keys(r).length === rehearsalKeys.length && rehearsalKeys.every(key => Object.hasOwn(r, key))
    && JSON.stringify(r) === auth.rehearsalRaw && r.status === 'STUDENT_PROFILE_AUDIT_REHEARSAL_OK'
    && r.releaseSha === item.releaseSha && r.sqlSha256 === STUDENT_PHOTO_SQL_SHA256
    && r.guardQualityRunId === item.qualityRunId && r.postgresMajor === 17
    && Number.isFinite(verified) && new Date(verified).toISOString() === r.verifiedAt && verified <= now
    && now - verified <= 2 * 60 * 60_000 && r.cleanupVerified === true && r.productionChanged === false
    && r.devDatabaseChanged === false && Array.isArray(r.checks) && r.checks.length === checks.length
    && new Set(r.checks).size === checks.length && checks.every(check => (r.checks as unknown[]).includes(check)),
  'PHOTO_MIGRATION_FRESH_REAL_REHEARSAL_REQUIRED');
  requireDeploymentWindow(item.windowStart, item.windowEnd, now);
  return { approval: item as unknown as StudentPhotoApproval, baseline };
}

/** One additive DDL transaction; NEVER deploys, writes business rows, changes the checkpoint or replays history. */
export async function applyStudentPhotoMigration(db: WriterSession, bundle: WriterPackage,
  auth: StudentPhotoAuthorization, live: { now(): number; revalidate(): Promise<void> }): Promise<StudentPhotoReceipt> {
  const now = live.now;
  requireMigration(auth.context.packageSha256 === bundle.packageSha256
    && JSON.stringify(createWriterPackage(bundle.snapshot)) === JSON.stringify(bundle), 'PHOTO_MIGRATION_PACKAGE_TAMPERED');
  const validated = validateStudentPhotoApproval(auth, now());
  const sql = await readStudentPhotoSql();
  await live.revalidate();
  let committing = false;
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await db.query("SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog,public,extensions");
    // Locks precede the first catalog SELECT, matching the existing reconciliation protocol.
    await db.query(`LOCK TABLE ${bundle.snapshot.tables.map(t => 'public.' + quoteIdentifier(t.relname)).sort().join(',')} IN SHARE MODE`);
    await db.query('LOCK TABLE auth.users, storage.objects, sinegasi_ops.production_reconciliation_runs IN SHARE MODE');
    requireMigration((await db.query("SELECT pg_try_advisory_xact_lock(hashtext('sinegasi:schema-migrations')) AS acquired"))
      .rows[0]?.acquired === true, 'PHOTO_MIGRATION_CONCURRENT_WRITER');
    const identitySql = `SELECT current_database() AS database,current_user AS actor,pg_backend_pid() AS pid,
      current_setting('server_version_num') AS version,current_setting('transaction_read_only') AS "readOnly"`;
    const identity = (await db.query(identitySql)).rows[0];
    requireMigration(identity?.database === 'postgres' && identity.actor === 'postgres' && identity.readOnly === 'off'
      && /^17[0-9]{4}$/.test(String(identity.version)) && Number.isInteger(identity.pid), 'PHOTO_MIGRATION_SESSION_IDENTITY_REQUIRED');
    await requireStudentPhotoAbsent(db);
    const before = await readDeploymentCatalog(db, bundle);
    requireDeploymentObservation(before, validated.baseline.observation);
    validateStudentPhotoApproval(auth, now());
    await db.query(sql);
    const catalog = await readWriterCatalog(db);
    const normalized = { ...catalog, inventory: { ...catalog.inventory, tables: catalog.inventory.tables.map(t => ({
      ...t, rows: String(bundle.reference.tables.find(reference => reference.name === t.name)?.rows.length ?? 0),
    })) } };
    const receipt: StudentPhotoReceipt = { operation: STUDENT_PHOTO_CHANGE, sqlSha256: STUDENT_PHOTO_SQL_SHA256,
      releaseSha: auth.context.releaseSha, approvalSha256: auth.confirmApproval,
      baselineEvidenceSha256: auth.context.evidenceSha256, beforeCatalogSha256: before.targetCatalogSha256,
      rehearsalSha256: validated.approval.rehearsalSha256,
      afterCatalogSha256: writerCatalogHash(normalized), appliedAt: new Date(now()).toISOString() };
    const after = await readDeploymentCatalog(db, bundle, receipt);
    requireMigration(after.targetCatalogSha256 === receipt.afterCatalogSha256, 'PHOTO_MIGRATION_POSTCONDITION_REQUIRED');
    const lastIdentity = (await db.query(identitySql)).rows[0];
    requireMigration(JSON.stringify(lastIdentity) === JSON.stringify(identity), 'PHOTO_MIGRATION_SESSION_CHANGED');
    await live.revalidate();
    validateStudentPhotoApproval(auth, now());
    committing = true;
    await db.query('COMMIT');
    return receipt;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (committing) throw new DeploymentGateError('PHOTO_MIGRATION_COMMIT_UNCERTAIN_INSPECT_DO_NOT_RETRY');
    throw error;
  }
}
