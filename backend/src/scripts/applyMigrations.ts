import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { runtimeConfig } from '../config/env.js';

const migrationFilePattern = /^(\d+)_.*\.sql$/;
const migrationHistoryTable = 'public.schema_migrations';
const existingDatabaseBaseline = Number(process.env.MIGRATION_BASELINE_VERSION ?? '74');

interface MigrationFile {
  name: string;
  version: number;
  path: string;
  checksum: string;
}

interface MigrationRecord {
  checksum: string;
}

function resolveMigrationDirectory(): string {
  const candidates = [
    path.resolve(__dirname, '../migrations'),
    path.resolve(__dirname, '../../src/migrations'),
  ];
  const migrationDirectory = candidates.find((candidate) => {
    if (!fs.existsSync(candidate)) return false;
    return fs.readdirSync(candidate).some((name) => migrationFilePattern.test(name));
  });
  if (!migrationDirectory) throw new Error('Direktori migration tidak ditemukan.');
  return migrationDirectory;
}

function discoverMigrationFiles(): MigrationFile[] {
  const migrationDirectory = resolveMigrationDirectory();
  return fs.readdirSync(migrationDirectory)
    .map((name) => {
      const match = migrationFilePattern.exec(name);
      if (!match) return null;

      const migrationPath = path.join(migrationDirectory, name);
      const checksum = createHash('sha256').update(fs.readFileSync(migrationPath)).digest('hex');
      return {
        name,
        version: Number(match[1]),
        path: migrationPath,
        checksum,
      } satisfies MigrationFile;
    })
    .filter((migration): migration is MigrationFile => migration !== null)
    .sort((left, right) => left.version - right.version || left.name.localeCompare(right.name));
}

async function ensureMigrationHistory(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationHistoryTable} (
      migration_name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    ALTER TABLE ${migrationHistoryTable}
      ADD COLUMN IF NOT EXISTS checksum TEXT
  `);
  await client.query(`
    UPDATE ${migrationHistoryTable}
    SET checksum = 'legacy-record'
    WHERE checksum IS NULL
  `);
  await client.query(`
    ALTER TABLE ${migrationHistoryTable}
      ALTER COLUMN checksum SET NOT NULL
  `);
  await client.query(`
    REVOKE ALL ON TABLE ${migrationHistoryTable} FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT, UPDATE ON TABLE ${migrationHistoryTable} TO service_role;
  `);
}

async function isExistingApplicationDatabase(client: Client): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('public.users') IS NOT NULL AS exists`,
  );
  return result.rows[0]?.exists === true;
}

async function hasMigrationRecords(client: Client): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM ${migrationHistoryTable}) AS exists`,
  );
  return result.rows[0]?.exists === true;
}

async function baselineExistingDatabase(client: Client, migrations: MigrationFile[]): Promise<void> {
  if (await hasMigrationRecords(client) || !(await isExistingApplicationDatabase(client))) return;

  const baselineMigrations = migrations.filter((migration) => migration.version <= existingDatabaseBaseline);
  if (baselineMigrations.length === 0) return;

  await client.query('BEGIN');
  try {
    for (const migration of baselineMigrations) {
      await client.query(
        `INSERT INTO ${migrationHistoryTable} (migration_name, checksum)
         VALUES ($1, $2)
         ON CONFLICT (migration_name) DO NOTHING`,
        [migration.name, migration.checksum],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Database existing dibaseline sampai migration ${String(existingDatabaseBaseline).padStart(3, '0')}.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function readMigrationRecord(client: Client, migrationName: string): Promise<MigrationRecord | null> {
  const result = await client.query<MigrationRecord>(
    `SELECT checksum FROM ${migrationHistoryTable} WHERE migration_name = $1`,
    [migrationName],
  );
  return result.rows[0] ?? null;
}

async function executeMigration(client: Client, migration: MigrationFile): Promise<void> {
  const sql = await readFile(migration.path, 'utf8');
  const ownsTransaction = /^\s*(BEGIN|START TRANSACTION)\b/m.test(sql);

  if (ownsTransaction) {
    await client.query(sql);
    return;
  }

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function recordMigration(client: Client, migration: MigrationFile): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO ${migrationHistoryTable} (migration_name, checksum)
       VALUES ($1, $2)`,
      [migration.name, migration.checksum],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function applyMigration(client: Client, migration: MigrationFile): Promise<'applied' | 'already-applied'> {
  const record = await readMigrationRecord(client, migration.name);
  if (record) {
    if (record.checksum !== migration.checksum && record.checksum !== 'legacy-record') {
      throw new Error(`Checksum migration berubah setelah diterapkan: ${migration.name}`);
    }
    return 'already-applied';
  }

  await executeMigration(client, migration);
  await recordMigration(client, migration);
  return 'applied';
}

async function runMigrations(databaseUrl: string): Promise<void> {
  const migrations = discoverMigrationFiles();
  if (migrations.length === 0) throw new Error('Tidak ada file migration SQL yang ditemukan.');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: /supabase|pooler/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query("SELECT pg_advisory_lock(hashtext('sinegasi:schema-migrations'))");
    await ensureMigrationHistory(client);
    await baselineExistingDatabase(client, migrations);

    let applied = 0;
    for (const migration of migrations) {
      const result = await applyMigration(client, migration);
      if (result === 'applied') {
        applied += 1;
        console.log(`${migration.name} berhasil diterapkan.`);
      }
    }

    console.log(`Schema migrations selesai. Baru: ${applied}.`);
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations'))").catch(() => undefined);
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
    await runMigrations(databaseUrl);
  } catch (error) {
    console.error('Schema migrations gagal diterapkan.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
