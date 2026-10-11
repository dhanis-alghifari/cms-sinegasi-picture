import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { buildMigrationConnectionConfig, transactionalSql } from './migrationSafety.js';

export const productionProjectRef = 'pvbdiftvzoeelibxlxzb';
const filePattern = /^(\d+)_.*\.sql$/;
const blockedSources: Readonly<Record<string, string>> = {
  '001_student_dashboard_tables.sql': 'Foundation incomplete: view depends on debt_records not created by this file.',
  '003_notifications_table.sql': 'Mixed schema and development sample notifications.',
  '004_grade_distribution_tables.sql': 'Mixed schema and development audit/contest/member seed.',
  '006_contest_film_works_tables.sql': 'Mixed schema and development contest/member seed.',
  '008_create_classes_table.sql': '45 seeded master classes and incompatible CREATE OR REPLACE VIEW column order; reconcile first.',
  '047_contest_schema_reconciliation.sql': 'References legacy columns absent from the fresh numbered migration chain.',
  '066_cash_migration_history_rls.sql': 'Requires legacy cash_migration_history table not created by numbered migrations.',
};

export interface MigrationAsset { name: string; checksum: string; sql: string }
export type MigrationDecision = 'apply' | 'exclude-development' | 'blocked' | 'review-required';
export interface ProductionManifest {
  formatVersion: 1;
  projectRef: string;
  status: 'draft' | 'approved';
  approval: null | {
    releaseSha: string;
    approvedBy: string;
    backupEvidence: string;
    restoreEvidence: string;
    rehearsalEvidence: string;
    schemaFingerprint: string;
  };
  entries: { name: string; checksum: string; decision: MigrationDecision; reason: string }[];
}

export interface MigrationDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export function migrationDirectory(): string {
  const candidates = [path.resolve(__dirname, '../migrations'), path.resolve(__dirname, '../../src/migrations')];
  const directory = candidates.find((candidate) => fs.existsSync(candidate) && fs.readdirSync(candidate).some((name) => filePattern.test(name)));
  if (!directory) throw new Error('Migration assets tidak ditemukan.');
  return directory;
}

export function discoverAssets(directory = migrationDirectory()): MigrationAsset[] {
  return fs.readdirSync(directory).filter((name) => filePattern.test(name))
    .sort((left, right) => Number(filePattern.exec(left)?.[1]) - Number(filePattern.exec(right)?.[1]) || left.localeCompare(right))
    .map((name) => {
      const bytes = fs.readFileSync(path.join(directory, name));
      return { name, checksum: createHash('sha256').update(bytes).digest('hex'), sql: bytes.toString('utf8') };
    });
}

export function createDraftManifest(assets: MigrationAsset[]): ProductionManifest {
  return {
    formatVersion: 1, projectRef: productionProjectRef, status: 'draft', approval: null,
    entries: assets.map(({ name, checksum }) => ({
      name, checksum,
      decision: name === '002_seed_data_development.sql' ? 'exclude-development' : blockedSources[name] ? 'blocked' : 'review-required',
      reason: name === '002_seed_data_development.sql' ? 'Development seed is never permitted in production.'
        : blockedSources[name] ?? 'Review DDL/DML, dependencies, privileges and isolated rehearsal before approval.',
    })),
  };
}

export function manifestFingerprint(manifest: ProductionManifest): string {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

/** Offline release gate; never imports runtime configuration or opens a DB. */
export function validateReleaseManifest(value: unknown, assets: MigrationAsset[], confirmedHash: string, releaseSha: string): ProductionManifest {
  const manifest = validateManifest(value, assets, true);
  if (!/^[a-f0-9]{40}$/.test(releaseSha) || manifest.approval?.releaseSha !== releaseSha
    || manifestFingerprint(manifest) !== confirmedHash) {
    throw new Error('Approval manifest harus cocok dengan exact release SHA dan fingerprint.');
  }
  return manifest;
}

export function validateManifest(value: unknown, assets: MigrationAsset[], applying: boolean): ProductionManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifest tidak valid.');
  const manifest = value as ProductionManifest;
  if (manifest.formatVersion !== 1 || manifest.projectRef !== productionProjectRef
    || !['draft', 'approved'].includes(manifest.status) || !Array.isArray(manifest.entries)
    || manifest.entries.length !== assets.length) throw new Error('Manifest target/inventory tidak cocok.');
  manifest.entries.forEach((entry, index) => {
    const asset = assets[index];
    if (!entry || entry.name !== asset.name || entry.checksum !== asset.checksum
      || !['apply', 'exclude-development', 'blocked', 'review-required'].includes(entry.decision)
      || typeof entry.reason !== 'string' || !entry.reason.trim()) throw new Error('Manifest order/checksum/review tidak cocok.');
    if (entry.decision === 'exclude-development' && entry.name !== '002_seed_data_development.sql') {
      throw new Error('Tidak boleh melewatkan schema migration sebagai development seed.');
    }
    if (entry.name === '002_seed_data_development.sql' && entry.decision !== 'exclude-development') throw new Error('Development seed ditolak.');
    if (applying && (entry.decision === 'blocked' || entry.decision === 'review-required' || blockedSources[entry.name])) {
      throw new Error(`Migration belum aman untuk production: ${entry.name}`);
    }
  });
  if (applying) {
    const approval = manifest.approval;
    if (manifest.status !== 'approved' || !approval || !/^[a-f0-9]{40}$/.test(approval.releaseSha)
      || !/^[a-f0-9]{64}$/.test(approval.schemaFingerprint)
      || [approval.approvedBy, approval.backupEvidence, approval.restoreEvidence, approval.rehearsalEvidence]
        .some((evidence) => typeof evidence !== 'string' || !evidence.trim())) {
      throw new Error('Approval release, backup, restore dan rehearsal wajib tersedia.');
    }
  }
  return manifest;
}

/** Metadata only. Fingerprint never includes business rows or passwords. */
export async function inspectDatabase(db: MigrationDatabase) {
  const result = await db.query(`SELECT jsonb_build_object(
    'tables', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', c.relname, 'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity, 'acl', c.relacl, 'owner', pg_get_userbyid(c.relowner)) ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')),
    'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object('table', table_name, 'name', column_name, 'type', udt_name, 'nullable', is_nullable, 'default', column_default) ORDER BY table_name, ordinal_position), '[]'::jsonb)
      FROM information_schema.columns WHERE table_schema='public'),
    'functions', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text, 'definition', md5(pg_get_functiondef(p.oid))) ORDER BY p.oid::regprocedure::text), '[]'::jsonb)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
    'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', indexname, 'definition', indexdef) ORDER BY indexname), '[]'::jsonb) FROM pg_indexes WHERE schemaname='public'),
    'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object('table', c.conrelid::regclass::text, 'name', c.conname, 'definition', pg_get_constraintdef(c.oid)) ORDER BY c.conrelid::regclass::text, c.conname), '[]'::jsonb)
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
    'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object('table', t.tgrelid::regclass::text, 'name', t.tgname, 'enabled', t.tgenabled, 'definition', pg_get_triggerdef(t.oid)) ORDER BY t.tgrelid::regclass::text, t.tgname), '[]'::jsonb)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
    'enums', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', t.typname, 'label', e.enumlabel) ORDER BY t.typname, e.enumsortorder), '[]'::jsonb)
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public'),
    'policies', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY tablename, policyname), '[]'::jsonb) FROM pg_policies p WHERE schemaname='public'),
    'grants', (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY table_name, grantee, privilege_type), '[]'::jsonb) FROM information_schema.role_table_grants g WHERE table_schema='public'),
    'function_acl', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text, 'acl', p.proacl) ORDER BY p.oid::regprocedure::text), '[]'::jsonb)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
    'views', (SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY viewname), '[]'::jsonb) FROM pg_views v WHERE schemaname='public'),
    'publications', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY pubname, tablename), '[]'::jsonb) FROM pg_publication_tables p WHERE schemaname='public'),
    'history', to_regclass('public.schema_migrations') IS NOT NULL
  ) AS inventory`);
  const inventory = result.rows[0]?.inventory;
  if (!inventory || typeof inventory !== 'object') throw new Error('Inventory database tidak valid.');
  const metadata = inventory as { tables: { name: string; rls: boolean }[]; history: boolean };
  const fingerprint = createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
  const history = metadata.history
    ? (await db.query('SELECT migration_name, checksum FROM public.schema_migrations ORDER BY migration_name')).rows
    : [];
  return { fingerprint, tables: metadata.tables, history };
}

/** Atomic DDL + history insert. Each enum migration commits before dependent files. */
export async function applyAsset(db: MigrationDatabase, asset: MigrationAsset): Promise<void> {
  const sql = transactionalSql(asset.sql);
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s'; SET LOCAL standard_conforming_strings=on");
    await db.query(sql);
    await db.query('INSERT INTO public.schema_migrations (migration_name, checksum) VALUES ($1, $2)', [asset.name, asset.checksum]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

export async function applyReviewedManifest(db: MigrationDatabase, value: unknown, assets: MigrationAsset[], confirmedFingerprint: string) {
  const manifest = validateManifest(value, assets, true);
  if (manifestFingerprint(manifest) !== confirmedFingerprint) throw new Error('Fingerprint approval tidak cocok.');
  const lock = await db.query("SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired");
  if (lock.rows[0]?.acquired !== true) throw new Error('Runner migration lain sedang berjalan.');
  try {
    const state = await inspectDatabase(db);
    if (state.fingerprint !== manifest.approval?.schemaFingerprint) throw new Error('Schema berubah sejak approval.');
    if (state.tables.some((table) => table.name !== 'schema_migrations') && state.history.length === 0) {
      throw new Error('Existing schema tanpa history: wajib rekonsiliasi, tidak ada baseline otomatis.');
    }
    const approved = new Map(manifest.entries.filter((entry) => entry.decision === 'apply').map((entry) => [entry.name, entry.checksum]));
    const recorded = new Set<string>();
    for (const row of state.history) {
      if (typeof row.migration_name !== 'string' || row.checksum !== approved.get(row.migration_name)) throw new Error('History legacy/unknown/checksum mismatch: rekonsiliasi diperlukan.');
      recorded.add(row.migration_name);
    }
    // Never rewrite, repair, or invent historical checksums for an existing DB.
    await db.query('BEGIN');
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (migration_name TEXT PRIMARY KEY, checksum TEXT NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'), applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.schema_migrations FROM PUBLIC, anon, authenticated, service_role;`);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
    let applied = 0;
    for (const asset of assets) {
      if (!approved.has(asset.name) || recorded.has(asset.name)) continue;
      await applyAsset(db, asset);
      applied += 1;
    }
    return { applied };
  } finally {
    await db.query("SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations'))").catch(() => undefined);
  }
}

async function main() {
  const [command = 'plan', ...args] = process.argv.slice(2);
  const assets = discoverAssets();
  if (command === 'plan' && args.length === 0) { console.log(JSON.stringify(createDraftManifest(assets), null, 2)); return; }
  if (!['status', 'apply', 'verify'].includes(command)) throw new Error('Gunakan plan, status, verify atau apply dengan konfirmasi target eksplisit.');
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--project-ref', '--manifest', '--confirm-manifest', '--release-sha'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw new Error('Argumen runner tidak valid.');
    options.set(args[i], args[i + 1]);
  }
  if (options.get('--project-ref') !== productionProjectRef) throw new Error('Konfirmasi project production wajib eksplisit.');
  if (command === 'verify') {
    const manifestPath = options.get('--manifest');
    if (!manifestPath || options.size !== 4) throw new Error('Verify memerlukan manifest, fingerprint, project dan release SHA.');
    validateReleaseManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown, assets,
      options.get('--confirm-manifest') ?? '', options.get('--release-sha') ?? '');
    console.log('Approved release manifest verified offline; no database accessed.');
    return;
  }
  if (options.has('--release-sha') || (command === 'status' && options.size !== 1)) throw new Error('Argumen tidak sesuai command.');
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL administratif wajib di-export; DATABASE_URL runtime tidak digunakan.');
  let manifest: ProductionManifest | undefined;
  if (command === 'apply') {
    const manifestPath = options.get('--manifest');
    if (!manifestPath) throw new Error('Manifest wajib tersedia.');
    manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown, assets, true);
    if (manifestFingerprint(manifest) !== options.get('--confirm-manifest')) throw new Error('Fingerprint approval tidak cocok.');
  }
  const client = new Client(buildMigrationConnectionConfig(url, productionProjectRef));
  try {
    await client.connect();
    if (command === 'status') {
      await client.query("BEGIN READ ONLY; SET LOCAL statement_timeout='10s'");
      console.log(JSON.stringify(await inspectDatabase(client), null, 2));
      await client.query('COMMIT');
    } else if (manifest) {
      console.log(JSON.stringify(await applyReviewedManifest(client, manifest, assets, options.get('--confirm-manifest') ?? '')));
    }
  } finally { await client.end(); }
}

if (require.main === module) void main().catch(() => {
  // PostgreSQL errors can contain SQL values or credentials. Never echo them.
  console.error('Production migration ditolak/gagal. Periksa gate, manifest dan status; jangan retry apply tanpa inventory baru.');
  process.exitCode = 1;
});
