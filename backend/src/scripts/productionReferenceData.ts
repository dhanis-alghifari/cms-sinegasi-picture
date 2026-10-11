import { resolve } from 'node:path';
import { CAPABILITY_VALUES, ROLE_CAPABILITIES } from '../middleware/capabilities.js';
import type { UserRole } from '../shared/auth/auth.types.js';
import { quoteIdentifier } from './productionBackupCore.js';
import { sha256, validateSnapshot, verifyCandidateFiles, type SchemaSnapshot } from './productionReconciliation.js';

type ReferenceValue = string | number | boolean | null;
export interface ReferenceTable {
  name: string;
  columns: string[];
  rows: ReferenceValue[][];
}
export interface ReferenceDataPlan {
  version: 1;
  schemaPackageSha256: string;
  snapshotSha256: string;
  billingAmount: number | null;
  tables: ReferenceTable[];
  checksum: string;
}
export interface ReferenceDatabase {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
}
export class ReferenceDataError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'ReferenceDataError'; }
}

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  teacher: 'Guru', leader: 'Ketua', vice_leader: 'Wakil Ketua', treasurer: 'Bendahara',
  secretary: 'Sekretaris', equipment_team: 'Tim Alat', contest_team: 'Tim Lomba',
  social_media_team: 'Tim Media Sosial', member: 'Anggota',
};
const WORK_TYPES = [
  ['short_film', 'Film Pendek', true, 10], ['documentary', 'Dokumenter', true, 20],
  ['photography', 'Fotografi', true, 30], ['animation', 'Animasi', true, 40],
  ['commercial', 'Iklan / Komersial', true, 50], ['music_video', 'Video Musik', true, 60],
  ['experimental', 'Eksperimental', true, 70], ['other', 'Lainnya', true, 99],
] satisfies ReferenceValue[][];
const HISTORY = 'sinegasi_ops.reference_data_history';
const RECEIPT = 'production-reference-data-v1';
const ISOLATED_DATABASES = ['sinegasi_schema_fresh', 'sinegasi_backup_restore'];

function sortedRows(rows: readonly (readonly unknown[])[]): string[] {
  return rows.map(row => JSON.stringify(row)).sort();
}
function permissionLabel(key: string): string {
  return key.replaceAll('.', ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

/** Canonical configuration from code contracts, never SELECT * from DEV or historical seed replay. */
export function createReferenceDataPlan(
  snapshot: SchemaSnapshot, schemaPackageSha256: string, billingAmount: number | null = null,
): ReferenceDataPlan {
  validateSnapshot(snapshot);
  if (!/^[a-f0-9]{64}$/.test(schemaPackageSha256)) throw new ReferenceDataError('REFERENCE_SCHEMA_CHECKSUM_INVALID');
  // Whole rupiah only. No implicit historical fee is adopted as production policy.
  if (billingAmount !== null && (!Number.isSafeInteger(billingAmount) || billingAmount < 500 || billingAmount > 9_999_999_999)) {
    throw new ReferenceDataError('REFERENCE_BILLING_AMOUNT_INVALID');
  }
  const roles = Object.keys(ROLE_LABELS) as UserRole[];
  const enumRoles = snapshot.enums.find(item => item.name === 'user_role')?.labels;
  if (!enumRoles || JSON.stringify([...enumRoles].sort()) !== JSON.stringify([...roles].sort())) {
    throw new ReferenceDataError('REFERENCE_ROLE_SCHEMA_MISMATCH');
  }
  const tables: ReferenceTable[] = [
    { name: 'access_roles', columns: ['role_key', 'label'], rows: roles.map(role => [role, ROLE_LABELS[role]]) },
    { name: 'access_permissions', columns: ['permission_key', 'label'], rows: CAPABILITY_VALUES.map(key => [key, permissionLabel(key)]) },
    { name: 'access_role_permissions', columns: ['role_key', 'permission_key'], rows: roles.flatMap(role => {
      const capabilities = ROLE_CAPABILITIES[role];
      if (new Set(capabilities).size !== capabilities.length || capabilities.some(key => !CAPABILITY_VALUES.includes(key))) {
        throw new ReferenceDataError('REFERENCE_CAPABILITY_CONTRACT_INVALID');
      }
      return capabilities.map(key => [role, key]);
    }) },
    // Cash is required by the ledger's fallback trigger. QRIS/provider setup is deliberately not copied.
    { name: 'cash_payment_methods', columns: ['code', 'label', 'is_active', 'sort_order', 'created_by', 'updated_by'],
      rows: [['cash', 'Cash', true, 10, null, null]] },
    { name: 'work_types', columns: ['code', 'label', 'is_active', 'sort_order'], rows: structuredClone(WORK_TYPES) },
    { name: 'cash_settings', columns: ['id', 'nominal_iuran_wajib', 'holiday_start_date', 'holiday_end_date', 'skip_week', 'created_by', 'updated_by'],
      rows: billingAmount === null ? [] : [[true, billingAmount, null, null, true, null, null]] },
  ];
  for (const table of tables) {
    const shape = snapshot.tables.find(item => item.relname === table.name);
    if (!shape || table.columns.some(name => !shape.columns.some(column => column.name === name))) {
      throw new ReferenceDataError('REFERENCE_TABLE_SCHEMA_MISMATCH');
    }
  }
  for (const required of ['users.manage', 'access_control.manage']) {
    if (!tables[2].rows.some(row => row[0] === 'teacher' && row[1] === required)) {
      throw new ReferenceDataError('REFERENCE_TEACHER_LOCKOUT');
    }
  }
  const content = { version: 1 as const, schemaPackageSha256, snapshotSha256: sha256(JSON.stringify(snapshot)), billingAmount, tables };
  return { ...content, checksum: sha256(JSON.stringify(content)) };
}

async function verifyReferenceRows(db: ReferenceDatabase, plan: ReferenceDataPlan): Promise<void> {
  for (const table of plan.tables) {
    const result = await db.query(`SELECT ${table.columns.map(quoteIdentifier).join(', ')} FROM public.${quoteIdentifier(table.name)}`);
    const rows = result.rows.map(row => table.columns.map(column =>
      column === 'nominal_iuran_wajib' ? Number(row[column]) : row[column]));
    if (JSON.stringify(sortedRows(rows)) !== JSON.stringify(sortedRows(table.rows))) {
      throw new ReferenceDataError('REFERENCE_DATA_DRIFT');
    }
  }
}

/** Rehearsal runner only. Supabase databases named postgres are ALWAYS refused.
 * Locks, exact reference rows and the private receipt commit in one transaction.
 * A future production runner needs independent catalog, backup and approval gates.
 */
export async function rehearseReferenceData(
  db: ReferenceDatabase, snapshot: SchemaSnapshot, schemaPackageSha256: string,
  billingAmount: number, confirmedChecksum: string,
): Promise<{ mode: 'applied' | 'noop'; checksum: string; referenceRows: number }> {
  const plan = createReferenceDataPlan(snapshot, schemaPackageSha256, billingAmount);
  if (plan.billingAmount === null) throw new ReferenceDataError('REFERENCE_BILLING_AMOUNT_REQUIRED');
  if (plan.checksum !== confirmedChecksum) throw new ReferenceDataError('REFERENCE_APPROVAL_CHECKSUM_MISMATCH');
  let started = false;
  let committing = false;
  try {
    await db.query('BEGIN'); started = true;
    await db.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='15s'; SET LOCAL search_path=pg_catalog,public");
    const identity = (await db.query('SELECT current_database() AS database, current_user AS actor')).rows[0];
    if (!ISOLATED_DATABASES.includes(String(identity?.database)) || identity?.actor !== 'postgres') {
      throw new ReferenceDataError('REFERENCE_ISOLATED_DATABASE_REQUIRED');
    }
    const lock = (await db.query("SELECT pg_try_advisory_xact_lock(hashtext('sinegasi:schema-migrations')) AS acquired")).rows[0];
    if (lock?.acquired !== true) throw new ReferenceDataError('REFERENCE_CONCURRENT_RUNNER_REFUSED');
    const inventory = (await db.query(`SELECT c.relname AS name, c.relrowsecurity AS rls FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`)).rows;
    if (inventory.length !== snapshot.tables.length || inventory.some(row => row.rls !== true)
      || JSON.stringify(inventory.map(row => row.name).sort()) !== JSON.stringify(snapshot.tables.map(table => table.relname).sort())) {
      throw new ReferenceDataError('REFERENCE_SCHEMA_NOT_READY');
    }
    await db.query(`LOCK TABLE ${snapshot.tables.map(table => `public.${quoteIdentifier(table.relname)}`).join(', ')} IN ACCESS EXCLUSIVE MODE`);
    // Never overwrite partial/custom configuration or fabricate historical migration receipts.
    const exists = (await db.query(`SELECT to_regclass('${HISTORY}') IS NOT NULL AS exists`)).rows[0]?.exists;
    if (typeof exists !== 'boolean') throw new ReferenceDataError('REFERENCE_HISTORY_STATE_INVALID');
    const prior = exists === true ? (await db.query(`SELECT checksum FROM ${HISTORY} WHERE name=$1`, [RECEIPT])).rows[0] : undefined;
    if (prior && prior.checksum !== plan.checksum) throw new ReferenceDataError('REFERENCE_RECEIPT_CHECKSUM_MISMATCH');
    for (const table of snapshot.tables) {
      if (prior && plan.tables.some(reference => reference.name === table.relname)) continue;
      const state = (await db.query(`SELECT EXISTS(SELECT 1 FROM public.${quoteIdentifier(table.relname)}) AS nonempty`)).rows[0];
      if (state?.nonempty !== false) throw new ReferenceDataError('REFERENCE_NONEMPTY_DATABASE_REFUSED');
    }
    if (prior) {
      await verifyReferenceRows(db, plan);
    } else {
      await db.query(`CREATE SCHEMA IF NOT EXISTS sinegasi_ops;
        REVOKE ALL ON SCHEMA sinegasi_ops FROM PUBLIC,anon,authenticated,service_role;
        CREATE TABLE IF NOT EXISTS ${HISTORY}(name text PRIMARY KEY, checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'), applied_at timestamptz NOT NULL DEFAULT now());
        REVOKE ALL ON ${HISTORY} FROM PUBLIC,anon,authenticated,service_role`);
      for (const table of plan.tables) {
        for (const row of table.rows) {
          await db.query(`INSERT INTO public.${quoteIdentifier(table.name)} (${table.columns.map(quoteIdentifier).join(', ')})
            VALUES (${row.map((_, index) => `$${index + 1}`).join(', ')})`, row);
        }
      }
      await verifyReferenceRows(db, plan);
      await db.query(`INSERT INTO ${HISTORY}(name,checksum) VALUES($1,$2)`, [RECEIPT, plan.checksum]);
    }
    committing = true;
    await db.query('COMMIT');
    return { mode: prior ? 'noop' : 'applied', checksum: plan.checksum, referenceRows: plan.tables.reduce((total, table) => total + table.rows.length, 0) };
  } catch (error: unknown) {
    if (started) await db.query('ROLLBACK').catch(() => undefined);
    if (committing) throw new ReferenceDataError('REFERENCE_COMMIT_UNCERTAIN_INSPECT_BEFORE_RETRY');
    if (error instanceof ReferenceDataError) throw error;
    // PostgreSQL exceptions may contain row data/credentials. Do not rethrow them.
    throw new ReferenceDataError('REFERENCE_REHEARSAL_FAILED');
  }
}

export function parseReferencePlanArguments(args: readonly string[]): number | null {
  if (args.length === 1 && args[0] === 'plan') return null;
  if (args.length === 3 && args[0] === 'plan' && args[1] === '--billing-amount' && /^[1-9][0-9]{2,9}$/.test(args[2])) {
    const amount = Number(args[2]);
    if (amount >= 500 && amount <= 9_999_999_999) return amount;
  }
  throw new ReferenceDataError('USE_PLAN_OPTIONAL_EXPLICIT_BILLING_AMOUNT_ONLY');
}

async function main(): Promise<void> {
  const billingAmount = parseReferencePlanArguments(process.argv.slice(2));
  const candidate = await verifyCandidateFiles(resolve(__dirname, '../../..'));
  const plan = createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, billingAmount);
  console.log(JSON.stringify({
    status: 'REFERENCE_DATA_PREPARATION_ONLY', schemaPackageSha256: candidate.fingerprint,
    referenceChecksum: plan.checksum,
    configuration: plan.tables.map(table => ({ table: table.name, rows: table.rows.length })),
    billingAmount: plan.billingAmount, billingAmountRequired: plan.billingAmount === null,
    billingSkipWeek: true, backgroundJobsMustRemainDisabled: true,
    source: 'reviewed code contracts; not DEV rows',
    username: 'admin', accountRole: 'teacher', accountCreated: false,
    nextGates: ['reference-data PostgreSQL rehearsal', 'managed Supabase and application integration',
      'production-only runner/release review', 'fresh backup and explicit production approval'],
    executableOnProduction: false, databaseAccessed: false, productionChanged: false, devChanged: false,
  }, null, 2));
}
if (require.main === module) void main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'STOP', stage: error instanceof ReferenceDataError ? error.code : 'REFERENCE_PLAN_FAILED', databaseAccessed: false }));
  process.exitCode = 1;
});
