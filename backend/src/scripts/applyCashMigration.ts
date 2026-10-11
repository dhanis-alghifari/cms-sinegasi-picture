import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { runtimeConfig } from '../config/env.js';
import { assertLegacyMigrationTarget } from './migrationSafety.js';

const migrationNames = [
  '011_cash_management_hardening.sql',
  '012_cash_legacy_schema_upgrade.sql',
  '016_cash_reporting.sql',
  '018_cash_accounting_report_hardening.sql',
  '020_cash_transaction_date_hardening.sql',
  '023_cash_payment_methods.sql',
  '024_cash_unpaid_atomic.sql',
  '045_cash_dispute_schema_compatibility.sql',
  '046_cash_dispute_monthly_quota.sql',
  '066_cash_migration_history_rls.sql',
  '071_cash_personal_scope_and_teacher_dispute_review.sql',
  '072_cash_dispute_single_pending.sql',
  '073_cash_dispute_per_target_pending.sql',
  '075_cash_dispute_derive_debt_amount.sql',
  '079_cash_dispute_read_all.sql',
] as const;

type MigrationName = (typeof migrationNames)[number];
type MigrationProbe = (client: Client) => Promise<boolean>;

const migrationHistoryTable = 'public.cash_migration_history';

async function schemaProbe(client: Client, sql: string): Promise<boolean> {
  const result = await client.query<{ complete: boolean }>(sql);
  return result.rows[0]?.complete === true;
}

const migrationProbes: Record<MigrationName, MigrationProbe> = {
  '011_cash_management_hardening.sql': (client) => schemaProbe(client, `
    SELECT to_regclass('public.cash_settings') IS NOT NULL
      AND to_regclass('public.cash_billing_runs') IS NOT NULL AS complete
  `),
  '012_cash_legacy_schema_upgrade.sql': (client) => schemaProbe(client, `
    SELECT NOT EXISTS (
      SELECT 1
      FROM (VALUES
        ('cash_transactions', 'type'),
        ('cash_transactions', 'nominal'),
        ('cash_transactions', 'saldo_sebelum'),
        ('cash_transactions', 'saldo_sesudah'),
        ('debt_records', 'keterangan'),
        ('debt_records', 'periode'),
        ('debt_records', 'idempotency_key'),
        ('cash_disputes', 'reason'),
        ('cash_disputes', 'student_id')
      ) AS required(table_name, column_name)
      WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns columns
        WHERE columns.table_schema = 'public'
          AND columns.table_name = required.table_name
          AND columns.column_name = required.column_name
      )
    ) AS complete
  `),
  '016_cash_reporting.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.get_cash_report(date,date)') IS NOT NULL AS complete
  `),
  '018_cash_accounting_report_hardening.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.get_cash_summary(uuid)') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.cash_transactions'::regclass
          AND tgname = 'trg_cash_transaction_immutable'
          AND NOT tgisinternal
      ) AS complete
  `),
  '020_cash_transaction_date_hardening.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.record_cash_in_on_date_atomic(text,numeric,text,text,text,text,text,text,numeric,date)') IS NOT NULL AS complete
  `),
  '023_cash_payment_methods.sql': (client) => schemaProbe(client, `
    SELECT to_regclass('public.cash_payment_methods') IS NOT NULL
      AND to_regprocedure('public.record_cash_in_on_date_with_method_atomic(text,numeric,text,text,text,text,text,text,numeric,date,text)') IS NOT NULL AS complete
  `),
  '024_cash_unpaid_atomic.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.record_cash_in_with_status_atomic(text,numeric,text,text,text,text,text,text,numeric,date,text)') IS NOT NULL AS complete
  `),
  '045_cash_dispute_schema_compatibility.sql': (client) => schemaProbe(client, `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cash_disputes'
        AND column_name = 'transaction_id'
        AND is_nullable = 'YES'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.cash_disputes'::regclass
        AND conname = 'cash_disputes_exactly_one_target_check'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.cash_disputes'::regclass
        AND conname = 'cash_disputes_status_check'
        AND pg_get_constraintdef(oid) LIKE '%approved%'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notifications'
        AND column_name = 'message'
    )
    AND COALESCE(pg_get_functiondef(to_regprocedure('public.fn_notify_cash_dispute()')), '') LIKE '%message%'
    AS complete
  `),
  '046_cash_dispute_monthly_quota.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.get_cash_dispute_quota(uuid)') IS NOT NULL
      AND to_regprocedure('public.create_cash_dispute_atomic(uuid,uuid,uuid,text,text,uuid,text)') IS NOT NULL
      AND to_regprocedure('public.review_cash_dispute_atomic(uuid,text,text,uuid,date,numeric,text)') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cash_disputes'
          AND column_name = 'quota_period_start'
      )
      AND to_regclass('public.uq_cash_disputes_active_transaction') IS NOT NULL
      AND to_regclass('public.uq_cash_disputes_active_debt') IS NOT NULL
      AS complete
  `),
  '066_cash_migration_history_rls.sql': (client) => schemaProbe(client, `
    SELECT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = to_regclass('public.cash_migration_history')
        AND relrowsecurity = TRUE
    ) AS complete
  `),
  '071_cash_personal_scope_and_teacher_dispute_review.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.guard_cash_dispute_actor()') IS NOT NULL
      AND to_regprocedure('public.guard_cash_dispute_reviewer()') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.cash_disputes'::regclass
          AND tgname = 'trg_guard_cash_dispute_actor'
          AND NOT tgisinternal
      )
      AND EXISTS (
        SELECT 1
        FROM public.access_role_permissions
        WHERE role_key = 'teacher' AND permission_key = 'cash.dispute.review'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.access_role_permissions
        WHERE role_key = 'treasurer' AND permission_key = 'cash.dispute.review'
      ) AS complete
  `),
  '072_cash_dispute_single_pending.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.create_cash_dispute_atomic(uuid,uuid,uuid,text,text,uuid,text)') IS NOT NULL
      AND to_regclass('public.idx_cash_disputes_student_pending') IS NOT NULL
      AND COALESCE(pg_get_functiondef(to_regprocedure('public.create_cash_dispute_atomic(uuid,uuid,uuid,text,text,uuid,text)')), '') LIKE '%student_id = p_student_id%status = ''pending''%'
      AS complete
  `),
  '073_cash_dispute_per_target_pending.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.create_cash_dispute_atomic(uuid,uuid,uuid,text,text,uuid,text)') IS NOT NULL
      AND COALESCE(pg_get_functiondef(to_regprocedure('public.create_cash_dispute_atomic(uuid,uuid,uuid,text,text,uuid,text)')), '') LIKE '%active-target check is intentionally scoped%'
      AND COALESCE(pg_get_functiondef(to_regprocedure('public.create_cash_dispute_atomic(uuid,uuid,uuid,text,text,uuid,text)')), '') NOT LIKE '%A student resolves one dispute at a time across both transactions and debts.%'
      AS complete
  `),
  '075_cash_dispute_derive_debt_amount.sql': (client) => schemaProbe(client, `
    SELECT to_regprocedure('public.review_cash_dispute_atomic(uuid,text,text,uuid,date,numeric,text)') IS NOT NULL
      AND COALESCE(pg_get_functiondef(to_regprocedure('public.review_cash_dispute_atomic(uuid,text,text,uuid,date,numeric,text)')), '') LIKE '%p_resolution_amount IS NOT NULL%'
      AND COALESCE(pg_get_functiondef(to_regprocedure('public.review_cash_dispute_atomic(uuid,text,text,uuid,date,numeric,text)')), '') LIKE '%v_debt.amount%'
      AS complete
  `),
  '079_cash_dispute_read_all.sql': (client) => schemaProbe(client, `
    SELECT EXISTS (
        SELECT 1 FROM public.access_permissions
        WHERE permission_key = 'cash.dispute.read.all'
      )
      AND EXISTS (
        SELECT 1 FROM public.access_role_permissions
        WHERE role_key = 'treasurer' AND permission_key = 'cash.dispute.read.all'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.access_role_permissions
        WHERE role_key = 'treasurer' AND permission_key = 'cash.dispute.review'
      ) AS complete
  `),
};

function resolveMigrationPath(migrationName: string): string {
  const candidates = [
    path.resolve(__dirname, '../migrations', migrationName),
    path.resolve(__dirname, '../../src/migrations', migrationName),
  ];
  const migrationPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!migrationPath) throw new Error(`File migration ${migrationName} tidak ditemukan.`);
  return migrationPath;
}

async function ensureMigrationHistory(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationHistoryTable} (
      migration_name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function isRecorded(client: Client, migrationName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM ${migrationHistoryTable} WHERE migration_name = $1) AS exists`,
    [migrationName],
  );
  return result.rows[0]?.exists === true;
}

async function recordMigration(client: Client, migrationName: string): Promise<void> {
  await client.query(
    `INSERT INTO ${migrationHistoryTable} (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING`,
    [migrationName],
  );
}

async function applyMigration(client: Client, migrationName: MigrationName): Promise<'applied' | 'already-applied' | 'skipped'> {
  if (await isRecorded(client, migrationName)) return 'already-applied';

  // Existing deployments predate migration history. A complete schema probe
  // safely baselines those installations without replaying data backfills.
  if (await migrationProbes[migrationName](client)) {
    await recordMigration(client, migrationName);
    return 'skipped';
  }

  await client.query(await readFile(resolveMigrationPath(migrationName), 'utf8'));
  await recordMigration(client, migrationName);
  return 'applied';
}

export async function runCashMigrations(databaseUrl: string): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: /supabase|pooler/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query('BEGIN');
    await ensureMigrationHistory(client);

    let applied = 0;
    let baselined = 0;
    for (const migrationName of migrationNames) {
      const result = await applyMigration(client, migrationName);
      if (result === 'applied') {
        applied += 1;
        console.log(`${migrationName} berhasil diterapkan.`);
      } else if (result === 'skipped') {
        baselined += 1;
        console.log(`${migrationName} sudah tersedia; dicatat sebagai baseline.`);
      }
    }

    await client.query('COMMIT');
    console.log(`Cash migrations selesai. Baru: ${applied}, baseline: ${baselined}.`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original migration error.
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cash migrations gagal: ${detail}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const databaseUrl = runtimeConfig.databaseUrl;
  if (!databaseUrl) {
    console.error('DATABASE_URL belum dikonfigurasi. Isi backend/.env atau export DATABASE_URL terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  try {
    assertLegacyMigrationTarget(databaseUrl, runtimeConfig.environment === 'production');
    await runCashMigrations(databaseUrl);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
