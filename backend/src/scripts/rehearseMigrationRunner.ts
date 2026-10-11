import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Client, type ClientConfig } from 'pg';
import { buildMigrationConnectionConfig } from './migrationSafety.js';
import { applyAsset, productionProjectRef, type MigrationAsset } from './productionMigrations.js';

/** Synthetic runner tests only; this does NOT validate the numbered production SQL package. */
export interface MigrationRunnerRehearsalResult {
  mode: 'isolated-runner-rehearsal';
  productionSqlPackageValidated: false;
  checks: string[];
}

export function buildRehearsalConnectionConfig(databaseUrl: string): ClientConfig {
  let url: URL;
  try { url = new URL(databaseUrl); }
  catch { throw new Error('Rehearsal memerlukan URL PostgreSQL lokal yang eksplisit.'); }
  // No DNS names, runtime DATABASE_URL or arbitrary URL options. Run only against
  // an operator-created isolated local PostgreSQL, never an SSH-forwarded port.
  if (!['127.0.0.1', '[::1]'].includes(url.hostname) || !url.port || !url.username
    || !/^\/sinegasi_migration_rehearsal_[a-z0-9_]{1,48}$/.test(url.pathname)) {
    throw new Error('Target wajib IP loopback, port eksplisit dan database disposable sinegasi_migration_rehearsal_*.');
  }
  return { ...buildMigrationConnectionConfig(databaseUrl, productionProjectRef, true),
    application_name: 'sinegasi-isolated-runner-rehearsal' };
}

async function assertEmptyDisposableDatabase(client: Client, databaseName: string): Promise<void> {
  await client.query('BEGIN READ ONLY');
  try {
    const result = await client.query<{
      database_name: string; server_address: string; objects: string; custom_schemas: string; extensions: string;
    }>(`SELECT current_database() AS database_name, host(inet_server_addr()) AS server_address,
      (SELECT count(*) FROM (
        SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public'
        UNION ALL SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public'
        UNION ALL SELECT t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
          WHERE n.nspname='public'
      ) owned) AS objects,
      (SELECT count(*) FROM pg_namespace WHERE nspname NOT IN ('public','information_schema')
        AND nspname NOT LIKE 'pg_%') AS custom_schemas,
      (SELECT count(*) FROM pg_extension WHERE extname <> 'plpgsql') AS extensions`);
    const row = result.rows[0];
    assert.equal(row?.database_name, databaseName, 'Database identity mismatch.');
    assert(['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(row?.server_address ?? ''),
      'Server reports a non-loopback address; remote targets are refused.');
    assert.equal(row?.objects, '0', 'Disposable database must be empty.');
    assert.equal(row?.custom_schemas, '0', 'Unexpected application schema.');
    assert.equal(row?.extensions, '0', 'Use a fresh dedicated PostgreSQL rehearsal database.');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

function asset(name: string, sql: string): MigrationAsset {
  return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
}

async function assertAbsent(client: Client, table: string, migrationName: string): Promise<void> {
  const result = await client.query<{ table_exists: boolean; history_count: string }>(
    `SELECT to_regclass($1) IS NOT NULL AS table_exists,
      (SELECT count(*) FROM public.schema_migrations WHERE migration_name=$2) AS history_count`,
    [`public.${table}`, migrationName]);
  assert.equal(result.rows[0]?.table_exists, false);
  assert.equal(result.rows[0]?.history_count, '0');
}

export async function rehearseMigrationRunner(databaseUrl: string): Promise<MigrationRunnerRehearsalResult> {
  const config = buildRehearsalConnectionConfig(databaseUrl);
  const client = new Client(config);
  const contender = new Client(config);
  const checks: string[] = [];
  let fixturesCreated = false;
  let lockAcquired = false;
  try {
    await client.connect();
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired");
    assert.equal(lock.rows[0]?.acquired, true, 'Another runner holds the session lock.');
    lockAcquired = true;
    await assertEmptyDisposableDatabase(client, new URL(databaseUrl).pathname.slice(1));
    await contender.connect();
    const busy = await contender.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired");
    assert.equal(busy.rows[0]?.acquired, false, 'Session lock must reject a concurrent connection.');
    checks.push('real-postgres-session-advisory-lock');

    // No Supabase/global roles are created or changed by this runner-only fixture.
    await client.query(`CREATE TABLE public.schema_migrations (
      migration_name TEXT PRIMARY KEY, checksum TEXT NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    fixturesCreated = true;
    await applyAsset(client, asset('054_fixture_first.sql',
      'BEGIN; CREATE TABLE public.sinegasi_rehearsal_first (id INTEGER PRIMARY KEY); COMMIT;'));
    await applyAsset(client, asset('054_fixture_second.sql',
      'CREATE TABLE public.sinegasi_rehearsal_second (id INTEGER PRIMARY KEY);'));
    const duplicatePrefix = await client.query<{ count: string }>(
      "SELECT count(*) FROM public.schema_migrations WHERE migration_name LIKE '054_%'");
    assert.equal(duplicatePrefix.rows[0]?.count, '2');
    checks.push('duplicate-numeric-prefix-recorded-by-full-filename');

    const sqlFailure = asset('055_fixture_sql_failure.sql',
      'BEGIN; CREATE TABLE public.sinegasi_rehearsal_sql_rollback (id INTEGER); SELECT 1/0; COMMIT;');
    await assert.rejects(applyAsset(client, sqlFailure));
    await assertAbsent(client, 'sinegasi_rehearsal_sql_rollback', sqlFailure.name);
    checks.push('ddl-and-history-rollback-on-sql-failure');

    const historyFailure = { ...asset('056_fixture_history_failure.sql',
      'CREATE TABLE public.sinegasi_rehearsal_history_rollback (id INTEGER);'), checksum: 'invalid-checksum' };
    await assert.rejects(applyAsset(client, historyFailure));
    await assertAbsent(client, 'sinegasi_rehearsal_history_rollback', historyFailure.name);
    checks.push('ddl-rollback-on-history-insert-failure');

    await assert.rejects(applyAsset(client, asset('054_fixture_first.sql',
      'CREATE TABLE public.sinegasi_rehearsal_duplicate_rollback (id INTEGER);')));
    const duplicateFailure = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.sinegasi_rehearsal_duplicate_rollback') IS NOT NULL AS exists");
    assert.equal(duplicateFailure.rows[0]?.exists, false);
    checks.push('ddl-rollback-on-duplicate-history-filename');

    await applyAsset(client, asset('081_fixture_enum.sql',
      "CREATE TYPE public.sinegasi_rehearsal_role AS ENUM ('teacher');"));
    await applyAsset(client, asset('082_fixture_enum_value.sql',
      "ALTER TYPE public.sinegasi_rehearsal_role ADD VALUE IF NOT EXISTS 'social_media_team';"));
    await applyAsset(client, asset('083_fixture_enum_consumer.sql',
      `CREATE TABLE public.sinegasi_rehearsal_enum_consumer (role public.sinegasi_rehearsal_role NOT NULL);
       INSERT INTO public.sinegasi_rehearsal_enum_consumer VALUES ('social_media_team');`));
    const enumConsumer = await client.query<{ role: string }>(
      'SELECT role FROM public.sinegasi_rehearsal_enum_consumer');
    assert.equal(enumConsumer.rows[0]?.role, 'social_media_team');
    checks.push('enum-addition-committed-before-dependent-file');

    await applyAsset(client, asset('084_fixture_function_body.sql',
      `BEGIN; CREATE FUNCTION public.sinegasi_rehearsal_function() RETURNS TEXT LANGUAGE plpgsql
       AS $body$ BEGIN RETURN 'fixture;value'; END; $body$; COMMIT;`));
    const functionBody = await client.query<{ value: string }>(
      'SELECT public.sinegasi_rehearsal_function() AS value');
    assert.equal(functionBody.rows[0]?.value, 'fixture;value');
    checks.push('outer-transaction-stripping-preserves-plpgsql-body');
    const history = await client.query<{ count: string }>('SELECT count(*) FROM public.schema_migrations');
    assert.equal(history.rows[0]?.count, '6');
  } catch {
    // Connection/database errors may contain credentials. Never emit their raw text.
    throw new Error('Isolated runner rehearsal gagal; tidak membuktikan package SQL production aman.');
  } finally {
    try {
      if (fixturesCreated) {
        // Drop only exact fixture objects created after the empty-database gate; never DROP DATABASE/SCHEMA/CASCADE.
        await client.query(`BEGIN;
          DROP TABLE IF EXISTS public.sinegasi_rehearsal_enum_consumer;
          DROP TABLE IF EXISTS public.sinegasi_rehearsal_first, public.sinegasi_rehearsal_second;
          DROP TABLE IF EXISTS public.sinegasi_rehearsal_sql_rollback, public.sinegasi_rehearsal_history_rollback,
            public.sinegasi_rehearsal_duplicate_rollback;
          DROP FUNCTION IF EXISTS public.sinegasi_rehearsal_function();
          DROP TYPE IF EXISTS public.sinegasi_rehearsal_role;
          DROP TABLE public.schema_migrations;
          COMMIT;`);
      }
    } catch {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error('Rehearsal cleanup gagal; periksa fixture lokal sebelum mengulang.');
    } finally {
      if (lockAcquired) await client.query(
        "SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations'))").catch(() => undefined);
      await Promise.all([client.end().catch(() => undefined), contender.end().catch(() => undefined)]);
    }
  }
  return { mode: 'isolated-runner-rehearsal', productionSqlPackageValidated: false, checks };
}

if (require.main === module) {
  const databaseUrl = process.env.ISOLATED_REHEARSAL_DATABASE_URL;
  if (!databaseUrl || process.argv.length !== 2) {
    console.error('Export ISOLATED_REHEARSAL_DATABASE_URL untuk database PostgreSQL lokal disposable kosong; tanpa argumen.');
    process.exitCode = 1;
  } else {
    void rehearseMigrationRunner(databaseUrl).then((result) => console.log(JSON.stringify(result))).catch(() => {
      console.error('Rehearsal lokal ditolak/gagal; package SQL production BELUM tervalidasi.');
      process.exitCode = 1;
    });
  }
}
