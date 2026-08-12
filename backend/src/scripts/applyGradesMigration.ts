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

  const candidates = [
    path.resolve(__dirname, '../migrations/013_grades_management_hardening.sql'),
    path.resolve(__dirname, '../../src/migrations/013_grades_management_hardening.sql'),
  ];
  const migrationPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!migrationPath) throw new Error('File migration 013_grades_management_hardening.sql tidak ditemukan.');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: /supabase|pooler/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(await readFile(migrationPath, 'utf8'));
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
