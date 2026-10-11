import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRehearsalConnectionConfig, rehearseMigrationRunner } from './rehearseMigrationRunner.js';

test('runner rehearsal refuses remote, default, ambiguous and URL-option targets before connecting', () => {
  const invalid = [
    'postgres://postgres:fixture@db.pvbdiftvzoeelibxlxzb.supabase.co:5432/postgres',
    'postgres://postgres:fixture@localhost:5432/sinegasi_migration_rehearsal_test',
    'postgres://postgres:fixture@127.0.0.1:5432/postgres',
    'postgres://postgres:fixture@127.0.0.1/sinegasi_migration_rehearsal_test',
    'postgres://127.0.0.1:5432/sinegasi_migration_rehearsal_test',
    'postgres://postgres:fixture@127.0.0.1:5432/sinegasi_migration_rehearsal_test?host=remote',
    'postgres://postgres:fixture@127.0.0.1:5432/sinegasi_migration_rehearsal_test?sslmode=disable',
    'postgres://postgres:fixture@127.0.0.1:5432/sinegasi_migration_rehearsal_test#fragment',
    'not-a-url',
  ];
  for (const value of invalid) {
    assert.throws(() => buildRehearsalConnectionConfig(value), (error: unknown) =>
      error instanceof Error && !error.message.includes('fixture') && !error.message.includes(value));
  }
});

test('runner rehearsal accepts only explicit loopback disposable database configuration', () => {
  for (const host of ['127.0.0.1', '[::1]']) {
    const config = buildRehearsalConnectionConfig(
      `postgres://postgres:fixture@${host}:55432/sinegasi_migration_rehearsal_test`);
    assert.equal(config.ssl, false);
    assert.equal(config.application_name, 'sinegasi-isolated-runner-rehearsal');
    assert.equal(config.connectionTimeoutMillis, 10_000);
  }
});

test('real PostgreSQL runner rehearsal: atomic history, rollback, duplicate 054, enum commit and session lock', {
  skip: process.env.ISOLATED_REHEARSAL_DATABASE_URL ? false
    : 'No explicit disposable localhost PostgreSQL; this is NOT a full production SQL-package rehearsal.',
}, async () => {
  const result = await rehearseMigrationRunner(process.env.ISOLATED_REHEARSAL_DATABASE_URL ?? '');
  assert.equal(result.productionSqlPackageValidated, false);
  assert.equal(result.mode, 'isolated-runner-rehearsal');
  assert.equal(result.checks.length, 7);
});
