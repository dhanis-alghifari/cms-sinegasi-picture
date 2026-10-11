import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLegacyMigrationTarget, buildMigrationConnectionConfig, splitSqlStatements, transactionalSql } from './migrationSafety.js';

const ref = 'pvbdiftvzoeelibxlxzb';
test('direct/session pooler project is explicit and TLS verified without URL overrides', () => {
  for (const url of [`postgresql://postgres:test@db.${ref}.supabase.co:5432/postgres?sslmode=require`, `postgresql://postgres.${ref}:test@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`]) {
    const config = buildMigrationConnectionConfig(url, ref);
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
    assert.equal(new URL(config.connectionString ?? '').search, '');
  }
});
test('wrong target, transaction pooling and insecure TLS hints are refused', () => {
  for (const url of [`postgresql://postgres:test@db.aaaaaaaaaaaaaaaaaaaa.supabase.co/postgres`, `postgresql://postgres.${ref}:test@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`, `postgresql://postgres:test@db.${ref}.supabase.co/postgres?sslmode=no-verify`, `postgresql://postgres:test@db.${ref}.supabase.co/postgres?sslcert=secret`, 'postgresql://postgres:test@evil.pooler.supabase.com.evil/postgres']) {
    assert.throws(() => buildMigrationConnectionConfig(url, ref));
  }
  assert.throws(() => buildMigrationConnectionConfig('not a url', ref), /tidak valid/);
});
test('local rehearsal cannot silently select a remote target and vice versa', () => {
  assert.throws(() => buildMigrationConnectionConfig('postgresql://localhost/test', ref));
  assert.equal(buildMigrationConnectionConfig('postgresql://127.0.0.1/test', ref, true).ssl, false);
  assert.throws(() => buildMigrationConnectionConfig(`postgresql://db.${ref}.supabase.co/postgres`, ref, true));
});
test('legacy runner refuses production while keeping dev target behavior', () => {
  assert.throws(() => assertLegacyMigrationTarget(`postgresql://db.${ref}.supabase.co/postgres`, false));
  assert.throws(() => assertLegacyMigrationTarget(`postgresql://DB.${ref.toUpperCase()}.SUPABASE.CO/postgres`, false));
  assert.throws(() => assertLegacyMigrationTarget(`postgresql://postgres.%70vbdiftvzoeelibxlxzb@aws-1-ap-southeast-1.pooler.supabase.com/postgres`, false));
  assert.throws(() => assertLegacyMigrationTarget('postgresql://localhost/dev', true));
  assert.doesNotThrow(() => assertLegacyMigrationTarget('postgresql://localhost/dev', false));
});
test('SQL parser preserves PL/pgSQL transaction words, semicolons and nested comments', () => {
  const sql = `-- prefix\nBEGIN; /* nested /* inner */ comment */ CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $body$ BEGIN RAISE NOTICE 'COMMIT;'; END $body$; INSERT INTO t VALUES ('a;''b'); COMMIT; -- trailing`;
  const body = transactionalSql(sql);
  assert.equal(splitSqlStatements(body).length, 2);
  assert.match(body, /BEGIN RAISE NOTICE 'COMMIT;'; END/);
  assert.doesNotMatch(body, /^-- prefix\nBEGIN;/);
});
test('standard string backslash is not confused with an E-string escape', () => {
  assert.equal(splitSqlStatements("SELECT '\\'; SELECT E'a\\\'b;';").length, 2);
});
test('unexpected transaction boundaries and transaction-incompatible DDL fail closed', () => {
  for (const sql of ['BEGIN; SELECT 1; COMMIT; SELECT 2;', 'SELECT 1; COMMIT;', 'ABORT;', "PREPARE TRANSACTION 'test';", 'CREATE INDEX CONCURRENTLY idx ON t(id);', 'VACUUM t;', 'START TRANSACTION; SELECT 1;', "SELECT $$unterminated;"]) {
    assert.throws(() => transactionalSql(sql));
  }
  assert.equal(transactionalSql('START TRANSACTION; SELECT 1; COMMIT;'), ' SELECT 1;');
});
