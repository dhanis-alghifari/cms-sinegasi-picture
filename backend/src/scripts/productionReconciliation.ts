import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { quoteIdentifier } from './productionBackupCore.js';

export interface Column { name: string; type: string; notNull: boolean; default: string | null; identity: string }
export interface Table { relname: string; relkind: string; relrowsecurity: boolean; columns: Column[] }
export interface SchemaSnapshot {
  format: number; sourceProject: string; targetProject: string; schemaOnly: boolean;
  tables: Table[]; legacyTables: Table[];
  enums: { name: string; labels: string[] }[];
  constraints: { table: string; name: string; type: string; definition: string }[];
  indexes: { table: string; name: string; definition: string }[];
  triggers: { table: string; name: string; definition: string }[];
  functions: { name: string; signature: string; arguments: string; definition: string; securityDefiner: boolean; config: string[] | null }[];
  views: { name: string; definition: string; options: string[] | null }[];
  policies: { table: string; name: string; permissive: string; roles: string; cmd: string; qual: string | null; check: string | null }[];
  sequences: unknown[];
}
export const RECONCILIATION_FILES = [
  '20261010235321_production_reconciliation_enums.sql',
  '20261010235346_production_reconciliation_schema.sql',
] as const;
export function sha256(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
/** PG deparser flattens this nested, purely conjunctive immutable predicate.
 * Allow exactly these two forms; never strip arbitrary parentheses/ORs. */
export function canonicalConstraintDefinition(name: string, definition: string): string {
  const old="CHECK ((((length(btrim(object_key)) >= 8) AND (length(btrim(object_key)) <= 1024)) AND (btrim(object_key) ~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$'::text)))";
  const canonical="CHECK (((length(btrim(object_key)) >= 8) AND (length(btrim(object_key)) <= 1024) AND (btrim(object_key) ~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$'::text)))";
  return name==='borrowing_return_evidence.borrowing_return_evidence_key_check' && definition===old ? canonical : definition;
}
const literal = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const tableName = (name: string): string => `public.${quoteIdentifier(name)}`;

export async function loadSnapshot(repository: string): Promise<SchemaSnapshot> {
  const snapshot: unknown = JSON.parse(await readFile(resolve(repository, 'ops/production-schema.snapshot.json'), 'utf8'));
  validateSnapshot(snapshot);
  return snapshot;
}
export function validateSnapshot(value: unknown): asserts value is SchemaSnapshot {
  const s = value as SchemaSnapshot;
  if (!s || s.format !== 1 || s.sourceProject !== 'cdvcwwcpjgmjvpdnytmz'
    || s.targetProject !== 'pvbdiftvzoeelibxlxzb' || s.schemaOnly !== true
    || !Array.isArray(s.tables) || !s.tables.length || !Array.isArray(s.legacyTables)
    || !['enums', 'constraints', 'indexes', 'triggers', 'functions', 'views', 'policies', 'sequences']
      .every(key => Array.isArray(s[key as keyof SchemaSnapshot])) || s.sequences.length) throw new Error('INVALID_SCHEMA_SNAPSHOT');
  const names = new Set(s.tables.map(t => t.relname));
  if (names.size !== s.tables.length) throw new Error('DUPLICATE_TABLE');
  for (const t of [...s.tables, ...s.legacyTables]) {
    if (!/^[a-z_][a-z0-9_]*$/.test(t.relname) || t.relkind !== 'r' || typeof t.relrowsecurity !== 'boolean'
      || !Array.isArray(t.columns) || !t.columns.length) throw new Error('UNSUPPORTED_TABLE');
    for (const c of t.columns) {
      if (!/^[a-z_][a-z0-9_]*$/.test(c.name) || c.identity || /[;\n]/.test(c.type)) throw new Error('UNSUPPORTED_COLUMN');
    }
  }
  for (const t of s.legacyTables) for (const c of t.columns) {
    if (!s.tables.find(x => x.relname === t.relname)?.columns.some(x => x.name === c.name && x.type === c.type)) {
      throw new Error('DESTRUCTIVE_COLUMN_CHANGE_REFUSED');
    }
  }
}
// Candidate files deliberately cannot run in Supabase's "postgres" database.
// Removing this restriction requires a separate production approval/runner.
const guard = `DO $guard$ BEGIN
  IF current_database() NOT IN ('sinegasi_backup_restore', 'sinegasi_schema_fresh') THEN
    RAISE EXCEPTION 'ISOLATED_REHEARSAL_DATABASE_REQUIRED';
  END IF;
END $guard$;`;
export function compileReconciliation(s: SchemaSnapshot): [string, string] {
  return compileSchema(s, guard, '-- REHEARSAL-ONLY CANDIDATE. No dev data, accounts or historical migration receipts.\n');
}

/** Separate production artifact: never remove/replace guards in rehearsal files.
 * The CLI supplies the stronger project, release, backup and approval boundary.
 */
export function compileProductionReconciliation(s: SchemaSnapshot): [string, string] {
  const productionGuard = `DO $guard$ BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'PRODUCTION_DATABASE_IDENTITY_REQUIRED';
  END IF;
END $guard$;`;
  return compileSchema(s, productionGuard, '-- REVIEWED-RUNNER ONLY. Never paste into SQL Editor or use db push.\n');
}

function compileSchema(s: SchemaSnapshot, databaseGuard: string, header: string): [string, string] {
  validateSnapshot(s);
  const enums = [header, databaseGuard, 'SET LOCAL search_path = pg_catalog, public, extensions;', ...s.enums.map(e => {
    const name = tableName(e.name);
    return `DO $enum$ BEGIN IF to_regtype(${literal(name)}) IS NULL THEN
      CREATE TYPE ${name} AS ENUM (${e.labels.map(literal).join(', ')});
      END IF; END $enum$;\n` + e.labels.map(label => `ALTER TYPE ${name} ADD VALUE IF NOT EXISTS ${literal(label)};`).join('\n');
  })].join('\n') + '\n';
  const names = s.tables.map(t => literal(t.relname)).join(',');
  const schema = [header, databaseGuard, `SET LOCAL search_path = pg_catalog, public, extensions;
SET LOCAL check_function_bodies = off;
DO $empty$ DECLARE t record; occupied boolean; BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN (${names})) THEN
    RAISE EXCEPTION 'UNKNOWN_TABLE_REFUSED';
  END IF;
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t.relname);
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t.relname) INTO occupied;
    IF occupied THEN RAISE EXCEPTION 'NONEMPTY_DATABASE_REFUSED'; END IF;
  END LOOP;
END $empty$;`,
    // FK dependencies must be removed before PK/unique constraints. No CASCADE.
    `DO $constraints$ DECLARE c record; BEGIN
  FOR c IN SELECT r.relname,co.conname FROM pg_constraint co JOIN pg_class r ON r.oid=co.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'
    ORDER BY CASE WHEN co.contype='f' THEN 0 ELSE 1 END LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',c.relname,c.conname);
  END LOOP;
END $constraints$;`,
    ...s.tables.flatMap(t => {
      const name = tableName(t.relname);
      const ddl = [`CREATE TABLE IF NOT EXISTS ${name} ();`];
      for (const c of t.columns) {
        const col = quoteIdentifier(c.name);
        ddl.push(`ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS ${col} ${c.type};`);
        ddl.push(`ALTER TABLE ${name} ALTER COLUMN ${col} ${c.default === null ? 'DROP DEFAULT' : `SET DEFAULT ${c.default}`};`);
        ddl.push(`ALTER TABLE ${name} ALTER COLUMN ${col} ${c.notNull ? 'SET' : 'DROP'} NOT NULL;`);
      }
      ddl.push(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;`);
      return ddl;
    }),
    ...s.functions.map(f => f.definition.trimEnd() + ';'),
    ...s.constraints.map(c => `ALTER TABLE ${tableName(c.table)} ADD CONSTRAINT ${quoteIdentifier(c.name)} ${c.definition};`),
    ...s.indexes.flatMap(i => [`DROP INDEX IF EXISTS public.${quoteIdentifier(i.name)};`, i.definition + ';']),
    ...s.views.map(v => `CREATE OR REPLACE VIEW ${tableName(v.name)} WITH (security_invoker=true) AS ${v.definition}`),
    ...s.triggers.flatMap(t => [`DROP TRIGGER IF EXISTS ${quoteIdentifier(t.name)} ON ${tableName(t.table)};`, t.definition + ';']),
    ...s.policies.flatMap(p => {
      const roles = p.roles.replace(/^\{|\}$/g, '').split(',').map(r => r === 'public' ? 'PUBLIC' : quoteIdentifier(r)).join(',');
      return [`DROP POLICY IF EXISTS ${quoteIdentifier(p.name)} ON ${tableName(p.table)};`,
        `CREATE POLICY ${quoteIdentifier(p.name)} ON ${tableName(p.table)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}`
        + (p.qual ? ` USING (${p.qual})` : '') + (p.check ? ` WITH CHECK (${p.check})` : '') + ';'];
    }),
    // Custom JWT auth is owned by Fastify. Browser roles have no direct DB access.
    'REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;',
    'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;',
    'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;',
    'GRANT USAGE ON SCHEMA public TO service_role;',
    ...s.tables.filter(t => t.relname !== 'schema_migrations' && !t.relname.endsWith('_migration_history'))
      .map(t => `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tableName(t.relname)} TO service_role;`),
    ...s.views.map(v => `GRANT SELECT ON ${tableName(v.name)} TO service_role;`),
    ...s.functions.flatMap(f => {
      const identity = `public.${quoteIdentifier(f.name)}(${f.arguments})`;
      const config = f.config?.find(c => c.startsWith('search_path='));
      const path = config?.slice('search_path='.length);
      return [`GRANT EXECUTE ON FUNCTION ${identity} TO service_role;`,
        `ALTER FUNCTION ${identity} SET search_path TO ${!path ? 'pg_catalog, public, pg_temp' : path === '""' ? "''" : path.includes('pg_temp') ? path : path + ', pg_temp'};`];
    }),
  ].join('\n').replaceAll('\r\n', '\n') + '\n';
  return [enums, schema];
}
export async function verifyCandidateFiles(repository: string): Promise<{ snapshot: SchemaSnapshot; sql: [string,string]; fingerprint: string }> {
  const snapshot = await loadSnapshot(repository);
  const sql = compileReconciliation(snapshot);
  for (let i=0; i<RECONCILIATION_FILES.length; i++) {
    if (await readFile(resolve(repository, 'supabase/migrations', RECONCILIATION_FILES[i]), 'utf8') !== sql[i]) {
      throw new Error('CANDIDATE_SQL_DOES_NOT_MATCH_SNAPSHOT');
    }
  }
  return { snapshot, sql, fingerprint: sha256(sql.join('\n')) };
}
