import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { runtimeConfig } from '../config/env.js';

const migrationNames = [
  '047_contest_schema_reconciliation.sql',
  '048_contest_media_works.sql',
  '049_contest_event_contract.sql',
  '050_contest_entry_results.sql',
  '051_contest_update_atomic.sql',
  '052_contest_scope_contract.sql',
  '053_contest_pipeline_evidence_contract.sql',
];
const historyTable = 'public.contest_migration_history';

function resolveMigrationPath(migrationName: string): string {
  const candidates = [
    path.resolve(__dirname, '../migrations', migrationName),
    path.resolve(__dirname, '../../src/migrations', migrationName),
  ];
  const migrationPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!migrationPath) throw new Error(`File migration ${migrationName} tidak ditemukan.`);
  return migrationPath;
}

async function hasHistoryTable(client: Client): Promise<boolean> {
  const result = await client.query<{ table_exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS table_exists`,
    [historyTable],
  );
  return result.rows[0]?.table_exists === true;
}

async function isMigrationRecorded(client: Client, migrationName: string): Promise<boolean> {
  if (!(await hasHistoryTable(client))) return false;
  const recorded = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM ${historyTable} WHERE migration_name = $1
    ) AS exists`,
    [migrationName],
  );
  return recorded.rows[0]?.exists === true;
}

async function main(): Promise<void> {
  const databaseUrl = runtimeConfig.databaseUrl;
  if (!databaseUrl) {
    console.error('DATABASE_URL belum dikonfigurasi. Isi backend/.env atau export DATABASE_URL terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: /supabase|pooler/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    for (const migrationName of migrationNames) {
      if (await isMigrationRecorded(client, migrationName)) {
        console.log(`${migrationName} sudah diterapkan.`);
        continue;
      }

      // Each SQL file owns its BEGIN/COMMIT and is safe to paste into Supabase SQL Editor.
      await client.query(await readFile(resolveMigrationPath(migrationName), 'utf8'));
      console.log(`${migrationName} berhasil diterapkan. PostgREST diminta reload schema.`);
    }
  } catch (error) {
    console.error('Migration kontes gagal diterapkan. Pastikan DATABASE_URL menunjuk ke database yang benar.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  console.error('Migration kontes gagal dijalankan.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
