import { createHash } from 'node:crypto';
import type { WriterSession } from './reconciliationWriterCatalog.js';
import { readWriterCatalog, verifyWriterTarget, writerCatalogHash } from './reconciliationWriterCatalog.js';
import { readManagedTrigram } from './reconciliationWriterExtensions.js';
import { requireCompletedBootstrapCheckpoint } from './productionBootstrapTeacherCore.js';
import type { WriterPackage } from './reconciliationWriterPolicy.js';
import { requireWriterQualityRun } from './reconciliationWriterPolicy.js';
import { deploymentReviewPolicy, type DeploymentReviewPolicy } from './productionDeploymentReview.js';
import { privateMediaEvidence, type PrivateMediaEvidence } from './productionMediaGate.js';
import { DeploymentGateError } from './productionDeploymentError.js';
export { DeploymentGateError } from './productionDeploymentError.js';

export const DEPLOYMENT_PROJECT = 'pvbdiftvzoeelibxlxzb';
const HASH = /^[a-f0-9]{64}$/;
const RELEASE = /^[a-f0-9]{40}$/;
export const deploymentHash = (raw: string): string => createHash('sha256').update(raw).digest('hex');
const requireGate: (condition: unknown, stage: string) => asserts condition = (condition, stage) => {
  if (!condition) throw new DeploymentGateError(stage);
};
function record(value: unknown): Record<string, unknown> {
  requireGate(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_GATE_DOCUMENT');
  return value as Record<string, unknown>;
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const item = record(value);
  requireGate(Object.keys(item).length === keys.length && keys.every(key => Object.hasOwn(item, key)), 'UNKNOWN_OR_MISSING_GATE_FIELD');
  return item;
}
function timestamp(value: unknown): number {
  requireGate(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value), 'INVALID_GATE_TIME');
  const time = Date.parse(value);
  requireGate(Number.isFinite(time) && new Date(time).toISOString() === value, 'INVALID_GATE_TIME');
  return time;
}
function fresh(value: unknown, now: number, age: number): number {
  const time = timestamp(value);
  requireGate(time <= now && now - time <= age, 'STALE_OR_FUTURE_GATE_EVIDENCE');
  return time;
}
export interface DeploymentObservation {
  packageSha256: string;
  targetCatalogSha256: string;
  migrationApprovalSha256: string;
  managedExtensionSha256: string;
  schemaSecuritySha256: string;
}
function observation(value: unknown): DeploymentObservation {
  const item = exact(value, ['packageSha256', 'targetCatalogSha256', 'migrationApprovalSha256', 'managedExtensionSha256', 'schemaSecuritySha256']);
  requireGate(Object.values(item).every(hash => typeof hash === 'string' && HASH.test(hash))
    && item.schemaSecuritySha256 === item.targetCatalogSha256, 'RECONCILED_SCHEMA_POSTCONDITION_REQUIRED');
  return item as unknown as DeploymentObservation;
}
export interface DeploymentEvidence {
  format: 2;
  mode: 'reconciled-no-sql';
  project: typeof DEPLOYMENT_PROJECT;
  releaseSha: string;
  snapshotSha256: string;
  observedAt: string;
  observation: DeploymentObservation;
  backup: Record<string, unknown>;
  restore: Record<string, unknown>;
  copy: Record<string, unknown>;
  independentKeyRecovery: Record<string, unknown>;
  rehearsal: Record<string, unknown>;
  reviewPolicy: DeploymentReviewPolicy;
  media: PrivateMediaEvidence;
}
export interface DeploymentGateContext {
  releaseSha: string;
  evidenceSha256: string;
  snapshotSha256: string;
  packageSha256: string;
  now: number;
}

/** Integrity/bindings, not an approval signature. Only a reviewed publisher may
 * supply this document; provider receipts are attested evidence, not live probes. */
export function validateDeploymentEvidence(raw: string, context: DeploymentGateContext): DeploymentEvidence {
  requireGate(raw.length <= 256 * 1024 && RELEASE.test(context.releaseSha) && HASH.test(context.evidenceSha256)
    && HASH.test(context.snapshotSha256) && HASH.test(context.packageSha256) && Number.isFinite(context.now)
    && deploymentHash(raw) === context.evidenceSha256, 'DEPLOYMENT_EVIDENCE_CHECKSUM_OR_CONTEXT_MISMATCH');
  const e = exact(JSON.parse(raw) as unknown, ['format', 'mode', 'project', 'releaseSha', 'snapshotSha256', 'observedAt',
    'observation', 'backup', 'restore', 'copy', 'independentKeyRecovery', 'rehearsal', 'reviewPolicy', 'media']);
  requireGate(JSON.stringify(e) === raw, 'CANONICAL_DEPLOYMENT_EVIDENCE_REQUIRED');
  requireGate(e.format === 2 && e.mode === 'reconciled-no-sql' && e.project === DEPLOYMENT_PROJECT
    && e.releaseSha === context.releaseSha && e.snapshotSha256 === context.snapshotSha256, 'DEPLOYMENT_SCOPE_OR_RELEASE_MISMATCH');
  const observed = fresh(e.observedAt, context.now, 30 * 60_000);
  deploymentReviewPolicy(e.reviewPolicy);
  const media = privateMediaEvidence(e.media, context.now);
  requireGate(timestamp(media.verifiedAt) <= observed, 'MEDIA_OBSERVATION_AFTER_DEPLOYMENT_EVIDENCE');
  const baseline = observation(e.observation);
  requireGate(baseline.packageSha256 === context.packageSha256, 'DEPLOYMENT_RECONCILIATION_PACKAGE_MISMATCH');
  const backup = record(e.backup), restore = record(e.restore), copy = record(e.copy);
  requireGate(typeof backup.id === 'string' && /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z$/.test(backup.id), 'DEPLOYMENT_BACKUP_ID_REQUIRED');
  const backupTime = fresh(backup.id.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z$/, 'T$1:$2:$3.$4Z'), context.now, 2 * 60 * 60_000);
  const archive = exact(backup.archive, ['sha256', 'bytes']), metadata = exact(backup.metadata, ['sha256', 'bytes']);
  for (const asset of [archive, metadata]) requireGate(typeof asset.sha256 === 'string' && HASH.test(asset.sha256)
    && Number.isSafeInteger(asset.bytes) && Number(asset.bytes) > 0, 'DEPLOYMENT_BACKUP_ASSET_INVALID');
  requireGate(backup.project === DEPLOYMENT_PROJECT && backup.encrypted === true && backup.productionChanged === false
    && backupTime <= observed && restore.id === backup.id && restore.project === DEPLOYMENT_PROJECT
    && restore.status === 'PUBLIC_APPLICATION_RESTORE_VERIFIED' && restore.productionChanged === false
    && restore.archiveSha256 === archive.sha256, 'DEPLOYMENT_RESTORE_BINDING_MISMATCH');
  const checks = record(restore.checks);
  requireGate(['tableRowsAndRlsMatch', 'columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch', 'publicExtensionsMatch']
    .every(key => checks[key] === true), 'DEPLOYMENT_RESTORE_PROOF_REQUIRED');
  requireGate(copy.status === 'ENCRYPTED_VPS_COPY_VERIFIED' && copy.id === backup.id && copy.project === DEPLOYMENT_PROJECT
    && copy.host === '43.157.242.8' && copy.sameHostAsApplication === true
    && copy.destination === `/opt/sinegasi-backups/production/${backup.id}` && copy.offDeviceBackupCopyVerified === true
    && copy.decryptionKeyTransferred === false && copy.databaseCredentialsTransferred === false
    && copy.productionChanged === false && copy.devCaddyUnchanged === true
    && copy.directoryMode === '0700' && copy.fileMode === '0600' && copy.owner === 'root' && Array.isArray(copy.files),
  'DEPLOYMENT_ENCRYPTED_COPY_REQUIRED');
  requireGate(fresh(copy.verifiedAt, context.now, 2 * 60 * 60_000) >= backupTime, 'DEPLOYMENT_COPY_TIME_MISMATCH');
  for (const [name, asset] of [['database.dump.age', archive], ['metadata.json.age', metadata]] as const) {
    const matches = copy.files.map(record).filter(file => file.name === name);
    requireGate(matches.length === 1 && matches[0].sha256 === asset.sha256 && matches[0].bytes === asset.bytes, 'DEPLOYMENT_COPY_CHECKSUM_MISMATCH');
  }
  // Public go-live does not inherit the old initialization-only Mac recovery exception.
  const key = exact(e.independentKeyRecovery, ['verified', 'sameDeviceAsMac', 'sameHostAsApplication', 'verifiedAt', 'medium', 'verifiedBy']);
  requireGate(key.verified === true && key.sameDeviceAsMac === false && key.sameHostAsApplication === false
    && typeof key.medium === 'string' && key.medium.trim().length > 0 && typeof key.verifiedBy === 'string'
    && key.verifiedBy.trim().length > 0, 'INDEPENDENT_DEPLOYMENT_RECOVERY_KEY_REQUIRED');
  fresh(key.verifiedAt, context.now, 2 * 60 * 60_000);
  const rehearsal = exact(e.rehearsal, ['status', 'releaseSha', 'packageSha256', 'verifiedAt', 'rollbackPassed', 'runtimePreflightPassed',
    'productionChanged', 'devDatabaseChanged']);
  requireGate(rehearsal.status === 'ISOLATED_DEPLOYMENT_REHEARSAL_PASSED' && rehearsal.releaseSha === context.releaseSha
    && rehearsal.packageSha256 === context.packageSha256 && rehearsal.rollbackPassed === true && rehearsal.runtimePreflightPassed === true
    && rehearsal.productionChanged === false && rehearsal.devDatabaseChanged === false, 'EXACT_RELEASE_DEPLOYMENT_REHEARSAL_REQUIRED');
  fresh(rehearsal.verifiedAt, context.now, 2 * 60 * 60_000);
  return e as unknown as DeploymentEvidence;
}

export function requireDeploymentWindow(start: string, end: string, now: number): void {
  const from = timestamp(start), to = timestamp(end);
  requireGate(Number.isFinite(now) && from <= now && now < to && to > from && to - from <= 45 * 60_000, 'APPROVED_DEPLOYMENT_WINDOW_REQUIRED');
}
export function requireDeploymentObservation(actual: DeploymentObservation, expected: DeploymentObservation): void {
  const a = observation(actual), e = observation(expected);
  requireGate(Object.keys(e).every(key => a[key as keyof DeploymentObservation] === e[key as keyof DeploymentObservation]), 'DEPLOYMENT_SCHEMA_OR_CHECKPOINT_DRIFT');
}

/** Read-only provider metadata, checked in BOTH environment-scoped CI jobs.
 * A variable named READY or an auto-created environment is not protection. */
export function requireProductionEnvironment(value: unknown, branchesValue: unknown, reviewValue: unknown = {
  mode: 'independent-review', owner: 'dhanis-alghifari', soloRiskAccepted: false,
}): void {
  const review = deploymentReviewPolicy(reviewValue);
  const env = record(value), policy = record(env.deployment_branch_policy), branches = record(branchesValue);
  requireGate(env.name === 'production' && Array.isArray(env.protection_rules)
    && (review.mode === 'solo-owner' || env.protection_rules.some(value => {
      const rule = record(value);
      return rule.type === 'required_reviewers' && rule.prevent_self_review === true
        && Array.isArray(rule.reviewers) && rule.reviewers.length > 0 && rule.reviewers.every(value => {
          const reviewer = record(value), identity = record(reviewer.reviewer);
          return ['User', 'Team'].includes(String(reviewer.type)) && Number.isSafeInteger(identity.id) && Number(identity.id) > 0;
        });
    })) && env.can_admins_bypass !== true && policy.protected_branches === false && policy.custom_branch_policies === true
    && branches.total_count === 1 && Array.isArray(branches.branch_policies) && branches.branch_policies.length === 1
    && record(branches.branch_policies[0]).name === 'main' && record(branches.branch_policies[0]).type === 'branch',
  'PRODUCTION_REVIEW_POLICY_AND_MAIN_BRANCH_REQUIRED');
}
export function requireDeploymentBindings(evidence: DeploymentEvidence, accountId: string, bucket: string, reviewMode: string): void {
  requireGate(evidence.media.accountId === accountId && evidence.media.bucket === bucket
    && evidence.reviewPolicy.mode === reviewMode, 'DEPLOYMENT_MEDIA_OR_REVIEW_BINDING_MISMATCH');
}
export function requireDeploymentQuality(run: unknown, jobs: unknown, releaseSha: string, mainValue: unknown): void {
  requireGate(RELEASE.test(releaseSha) && record(mainValue).sha === releaseSha, 'CURRENT_MAIN_DEPLOYMENT_RELEASE_REQUIRED');
  requireWriterQualityRun(run, jobs, releaseSha);
}

/** Existing schema/reference verifier; only row counts are normalized. Business
 * data and login are NOT accepted here. No DDL/history writes or auth RPCs. */
export async function inspectDeploymentSchema(db: WriterSession, bundle: WriterPackage): Promise<DeploymentObservation> {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await db.query("SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog,public,extensions");
    const identity = (await db.query(`SELECT current_database() AS database,current_user AS actor,
      current_setting('transaction_read_only') AS "readOnly",current_setting('server_version_num') AS version`)).rows[0];
    requireGate(identity?.database === 'postgres' && identity.actor === 'postgres' && identity.readOnly === 'on'
      && /^17[0-9]{4}$/.test(String(identity.version)), 'DEPLOYMENT_READ_ONLY_SESSION_REQUIRED');
    const checkpoint = await requireCompletedBootstrapCheckpoint(db, bundle);
    const managedRows = (await db.query(`SELECT (SELECT count(*)::text FROM auth.users) AS accounts,
      (SELECT count(*)::text FROM storage.objects) AS objects`)).rows[0];
    requireGate(managedRows?.accounts === '0' && managedRows.objects === '0', 'MANAGED_SCHEMA_RECOVERY_REVIEW_REQUIRED');
    const managed = await readManagedTrigram(db), catalog = await readWriterCatalog(db);
    const inventory = { ...catalog.inventory, tables: catalog.inventory.tables.map(table => ({ ...table,
      rows: String(bundle.reference.tables.find(reference => reference.name === table.name)?.rows.length ?? 0) })) };
    const verified = await verifyWriterTarget({ query: db.query.bind(db), inventory: async () => inventory }, bundle.snapshot, bundle.reference, managed.sha256);
    const result = { packageSha256: bundle.packageSha256, ...checkpoint, managedExtensionSha256: managed.sha256,
      schemaSecuritySha256: writerCatalogHash(verified) };
    observation(result); // Must equal the complete checkpoint, not merely its table count.
    return result;
  } finally { await db.query('ROLLBACK'); }
}
