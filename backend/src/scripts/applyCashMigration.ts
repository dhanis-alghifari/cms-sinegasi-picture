import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { runtimeConfig } from '../config/env.js';

async function main(): Promise<void> {
  const databaseUrl = runtimeConfig.databaseUrl;
  if (!databaseUrl) {
    console.error('DATABASE_URL belum dikonfigurasi. Isi backend/.env atau export DATABASE_URL terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  const migrationNames = [
    '011_cash_management_hardening.sql',
    '012_cash_legacy_schema_upgrade.sql',
    '016_cash_reporting.sql',
    '018_cash_accounting_report_hardening.sql',
    '020_cash_transaction_date_hardening.sql',
    '023_cash_payment_methods.sql',
    '024_cash_unpaid_atomic.sql',
  ];
  const migrations = migrationNames.map((migrationName) => {
    const candidates = [
      path.resolve(__dirname, '../migrations', migrationName),
      path.resolve(__dirname, '../../src/migrations', migrationName),
    ];
    const migrationPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!migrationPath) throw new Error(`File migration ${migrationName} tidak ditemukan.`);
    return { migrationName, migrationPath };
  });
  const client = new Client({
    connectionString: databaseUrl,
    ssl: /supabase|pooler/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query('BEGIN');
    for (const migration of migrations) {
      await client.query(await readFile(migration.migrationPath, 'utf8'));
      console.log(`${migration.migrationName} berhasil diterapkan.`);
    }
    await client.query('COMMIT');
    console.log('Cash migrations berhasil diterapkan dan schema cache diminta untuk reload.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original migration error.
    }
    console.error('Cash migrations gagal diterapkan. Pastikan DATABASE_URL menunjuk ke database yang benar.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  console.error('Cash migrations 011/012/016/018/020/023/024 gagal dijalankan.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
