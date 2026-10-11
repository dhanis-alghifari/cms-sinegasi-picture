import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DatabaseInventory } from './productionBackupCore.js';
import { BACKUP_PROJECT } from './productionBackupCore.js';
import { parseApiEvidence } from './productionApiRehearsalCore.js';
import { createReferenceDataPlan } from './productionReferenceData.js';
import { sha256, verifyCandidateFiles, type SchemaSnapshot } from './productionReconciliation.js';

export class ReconciliationPreflightError extends Error {
  constructor(public readonly stage: string) { super(stage); }
}

export const REQUIRED_API_CHECKS = [
  'EXACT_RUNTIME_DEPENDENCIES', 'EMPTY_DISPOSABLE_CONFIG_AND_BOOTSTRAP',
  'PUBLIC_DEPLOYMENT_NO_MOCKS_WORKERS_DISABLED', 'NO_TOKEN_REJECTED', 'INVALID_LOGIN_REJECTED',
  'FIXTURE_FIRST_LOGIN', 'FIRST_LOGIN_OPERATION_BLOCKED', 'PASSWORD_MISMATCH_NO_CHANGE',
  'PASSWORD_RPC_AND_AUDIT', 'OLD_JWT_REVOKED', 'OLD_PASSWORD_REJECTED', 'NEW_PASSWORD_LOGIN',
  'TEACHER_CONFIG_AND_EMPTY_DASHBOARD', 'MEMBER_FIXTURE_OWNERSHIP', 'MEMBER_CASH_MUTATION_DENIED',
  'CASH_RPC_AND_REPLAY_NO_DUPLICATE', 'CASH_OUT_AND_BALANCE', 'CASH_INSUFFICIENT_BALANCE_ROLLBACK',
  'BROWSER_TABLE_AND_RPC_DENIED', 'INACTIVE_ACCOUNT_REJECTED', 'DATABASE_OUTAGE_FAILS_CLOSED',
] as const;
const SCHEMA_CHECKS = [
  'freshDatabase', 'emptyBusinessTables', 'rlsAllTables', 'columnsConstraintsIndexesEnumsViewsTriggersPoliciesMatch',
  'functionBodiesAndDefinerSemanticsPreserved', 'browserTableAndRpcDenied', 'serviceRoleAccess',
  'ddlAndHistoryRollback', 'repeatIsNoop', 'checksumDriftRefused', 'nonemptyDatabaseRefused', 'concurrentRunnerRefused',
] as const;
const REFERENCE_CHECKS = [
  'emptyBusinessTablesBeforeBootstrap', 'referenceRowsAndReceiptRollback', 'concurrentRunnerRefused',
  'nonemptyRefused', 'repeatIsVerifiedNoop', 'changedReceiptAndDataRefused', 'browserDenied',
  'serviceRoleConfigurationRead', 'privateReceiptDenied', 'fixtureTeacherScryptAndForcedPasswordChange', 'bootstrapCanonicalAudit',
] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ReconciliationPreflightError('INVALID_PREFLIGHT_INPUT');
  return value as Record<string, unknown>;
}
function requireChecks(value: unknown, keys: readonly string[]): void {
  const checks = record(value);
  if (keys.some(key => checks[key] !== true)) throw new ReconciliationPreflightError('REHEARSAL_CHECKS_INCOMPLETE');
}
function requireUnchangedReceipt(receipt: Record<string, unknown>): void {
  if (receipt.cleanupVerified !== true || receipt.productionChanged !== false || receipt.devDatabaseChanged !== false
    || receipt.productionApproved !== false || receipt.managedSupabaseIntegrationTested !== false
    || typeof receipt.verifiedAt !== 'string' || !Number.isFinite(Date.parse(receipt.verifiedAt))) {
    throw new ReconciliationPreflightError('REHEARSAL_RECEIPT_NOT_SAFE');
  }
}

export function requirePreflightMode(args: readonly string[]): 'plan' | 'preflight' {
  if (args.length !== 1 || (args[0] !== 'plan' && args[0] !== 'preflight')) {
    throw new ReconciliationPreflightError('ONLY_PLAN_OR_READONLY_PREFLIGHT_AVAILABLE');
  }
  return args[0];
}

export interface PreflightPlan {
  status: 'RECONCILIATION_PREFLIGHT_PLAN_READY';
  project: string;
  schemaPackageSha256: string;
  snapshotSha256: string;
  referenceChecksum: string;
  billingAmount: 5000;
  targetTables: number;
  expectedLegacyTables: number;
  referenceRows: number;
  apiChecks: number;
  evidenceSha256: Record<string, string>;
  historicalBackupId: string;
  applyAvailable: false;
  productionApproved: false;
  productionChanged: false;
  pending: readonly string[];
}

export function validatePreflightEvidence(
  snapshot: SchemaSnapshot, fingerprint: string, receipts: Readonly<Record<string, unknown>>,
): { referenceChecksum: string; referenceRows: number; historicalBackupId: string } {
  const plan = createReferenceDataPlan(snapshot, fingerprint, 5000);
  for (const [file, status, restored] of [
    ['production-reconciliation.fresh-rehearsal.json', 'RECONCILIATION_FRESH_REHEARSAL_PASSED', false],
    ['production-reconciliation.rehearsal.json', 'RECONCILIATION_SCHEMA_REHEARSAL_PASSED', true],
  ] as const) {
    const receipt = record(receipts[file]);
    requireUnchangedReceipt(receipt);
    requireChecks(receipt.checks, SCHEMA_CHECKS);
    if (receipt.status !== status || receipt.packageSha256 !== fingerprint
      || record(receipt.checks).restoredLegacyBackup !== restored
      || receipt.tables !== snapshot.tables.length || receipt.functions !== snapshot.functions.length
      || receipt.constraints !== snapshot.constraints.length || receipt.indexes !== snapshot.indexes.length
      || receipt.triggers !== snapshot.triggers.length) throw new ReconciliationPreflightError('SCHEMA_REHEARSAL_PACKAGE_MISMATCH');
  }
  const legacy = record(receipts['production-reconciliation.rehearsal.json']);
  if (legacy.project !== BACKUP_PROJECT || typeof legacy.backupId !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(legacy.backupId)
    || typeof legacy.archiveSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(legacy.archiveSha256)) {
    throw new ReconciliationPreflightError('LEGACY_RESTORE_EVIDENCE_INVALID');
  }
  const reference = record(receipts['production-reference-data.rehearsal.json']);
  requireUnchangedReceipt(reference);
  requireChecks(reference.checks, REFERENCE_CHECKS);
  const rows = plan.tables.reduce((sum, table) => sum + table.rows.length, 0);
  if (reference.status !== 'REFERENCE_DATA_REHEARSAL_PASSED' || reference.schemaPackageSha256 !== fingerprint
    || reference.referenceChecksum !== plan.checksum || reference.billingAmount !== 5000
    || reference.referenceRows !== rows || reference.liveAccountCreated !== false) {
    throw new ReconciliationPreflightError('REFERENCE_REHEARSAL_PACKAGE_MISMATCH');
  }
  const api = parseApiEvidence(JSON.stringify(receipts['production-api.rehearsal.json']), fingerprint, plan.checksum);
  requireUnchangedReceipt(api);
  const checks = api.checks as string[]; // parseApiEvidence validates each element.
  if (checks.length !== REQUIRED_API_CHECKS.length || new Set(checks).size !== checks.length
    || REQUIRED_API_CHECKS.some(check => !checks.includes(check))) throw new ReconciliationPreflightError('API_CHECKS_INCOMPLETE');
  return { referenceChecksum: plan.checksum, referenceRows: rows, historicalBackupId: legacy.backupId };
}

export async function loadPreflightPlan(repository: string): Promise<{ plan: PreflightPlan; snapshot: SchemaSnapshot }> {
  const { snapshot, fingerprint } = await verifyCandidateFiles(repository);
  const receipts: Record<string, unknown> = {};
  const evidenceSha256: Record<string, string> = {};
  for (const file of ['production-reconciliation.fresh-rehearsal.json', 'production-reconciliation.rehearsal.json',
    'production-reference-data.rehearsal.json', 'production-api.rehearsal.json']) {
    const handle = await open(resolve(repository, 'ops', file), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 1_048_576) throw new ReconciliationPreflightError('UNSAFE_EVIDENCE_FILE');
      const raw = await handle.readFile('utf8');
      receipts[file] = JSON.parse(raw) as unknown;
      evidenceSha256[file] = sha256(raw);
    } finally { await handle.close(); }
  }
  const evidence = validatePreflightEvidence(snapshot, fingerprint, receipts);
  return { snapshot, plan: {
    status: 'RECONCILIATION_PREFLIGHT_PLAN_READY', project: BACKUP_PROJECT,
    schemaPackageSha256: fingerprint, snapshotSha256: sha256(JSON.stringify(snapshot)),
    ...evidence, billingAmount: 5000, targetTables: snapshot.tables.length,
    expectedLegacyTables: snapshot.legacyTables.length, apiChecks: REQUIRED_API_CHECKS.length, evidenceSha256,
    applyAvailable: false, productionApproved: false, productionChanged: false,
    pending: ['REVIEW_AND_TEST_PRODUCTION_WRITE_RUNNER', 'BIND_REVIEWED_RELEASE_AND_CURRENT_CATALOG',
      'FRESH_BACKUP_RESTORE_AND_RECOVERY_COPY', 'APPROVED_MIGRATION_WINDOW', 'MANAGED_POST_MIGRATION_ACCEPTANCE'],
  } };
}

export function requireReadOnlyProductionIdentity(value: unknown): string {
  const info = record(value);
  if (info.database !== 'postgres' || info.actor !== 'postgres' || info.readOnly !== 'on'
    || typeof info.version !== 'string' || !/^17\./.test(info.version)) {
    throw new ReconciliationPreflightError('PRODUCTION_READONLY_IDENTITY_REQUIRED');
  }
  return info.version;
}

/** Checks the legacy table/column baseline, not complete backup/provider parity.
 * The full public inventory hash binds later review to this observed catalog.
 */
export function validateLegacyInventory(inventory: DatabaseInventory, snapshot: SchemaSnapshot): { catalogSha256: string; tables: number; totalPublicRows: 0 } {
  const actualNames = inventory.tables.map(table => table.name).sort();
  const expectedNames = snapshot.legacyTables.map(table => table.relname).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)
    || inventory.tables.some(table => table.schema !== 'public' || table.forceRls !== false
      || table.rls !== snapshot.legacyTables.find(expected => expected.relname === table.name)?.relrowsecurity)) {
    throw new ReconciliationPreflightError('LEGACY_TABLE_BASELINE_CHANGED');
  }
  if (inventory.tables.some(table => table.rows !== '0')) throw new ReconciliationPreflightError('NONEMPTY_PRODUCTION_REFUSED');
  const actualColumns = inventory.structure.filter(item => item.kind === 'column').map(item => {
    if (typeof item.name !== 'string' || typeof item.definition !== 'string') throw new ReconciliationPreflightError('INVALID_COLUMN_METADATA');
    const d = record(JSON.parse(item.definition) as unknown);
    if (d.generated !== '') throw new ReconciliationPreflightError('GENERATED_COLUMN_REFUSED');
    return JSON.stringify([item.name, d.type, d.notNull, d.default, d.identity]);
  }).sort();
  const expectedColumns = snapshot.legacyTables.flatMap(table => table.columns.map(column =>
    JSON.stringify([`${table.relname}.${column.name}`, column.type, column.notNull, column.default, column.identity]))).sort();
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) throw new ReconciliationPreflightError('LEGACY_COLUMNS_CHANGED');
  return { catalogSha256: sha256(JSON.stringify(inventory)), tables: inventory.tables.length, totalPublicRows: 0 };
}
