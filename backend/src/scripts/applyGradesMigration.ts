import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { runtimeConfig } from '../config/env.js';
import { assertLegacyMigrationTarget } from './migrationSafety.js';

async function main(): Promise<void> {
  const databaseUrl = runtimeConfig.databaseUrl;
  if (!databaseUrl) {
    console.error('DATABASE_URL belum dikonfigurasi. Isi backend/.env atau export DATABASE_URL terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  const migrationNames = ['013_grades_management_hardening.sql', '074_grade_reports_and_pkl_periods.sql'];
  const migrationPaths = migrationNames.map((name) => {
    const candidates = [path.resolve(__dirname, `../migrations/${name}`), path.resolve(__dirname, `../../src/migrations/${name}`)];
    const migrationPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!migrationPath) throw new Error(`File migration ${name} tidak ditemukan.`);
    return migrationPath;
  });

  const client = new Client({
    connectionString: databaseUrl,
    ssl: /supabase|pooler/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    assertLegacyMigrationTarget(databaseUrl, runtimeConfig.environment === 'production');
    await client.connect();
    await client.query('BEGIN');
    for (const migrationPath of migrationPaths) await client.query(await readFile(migrationPath, 'utf8'));
    await client.query('COMMIT');
    console.log('Migration nilai berhasil diterapkan dan schema cache diminta untuk reload.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original migration error.
    }
    console.error('Migration nilai gagal diterapkan. Pastikan DATABASE_URL menunjuk ke database yang benar.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  console.error('Migration nilai gagal dijalankan.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
