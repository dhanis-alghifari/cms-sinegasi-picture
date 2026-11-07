import { createHash } from 'node:crypto';
import type { SchemaSnapshot } from './productionReconciliation.js';
import type { WriterCatalog, WriterSession } from './reconciliationWriterCatalog.js';
import { DeploymentGateError } from './productionDeploymentError.js';

/** Exact, previously observed PostgreSQL definitions; no whitespace normalization. */
const FUNCTIONS: Readonly<Record<string, string>> = {
  'create_student_with_account_v2(text,text,text,text,text,text,text,text,uuid,text,uuid,text,text,uuid,uuid,text)': 'febf1bdb1f544ef8446492b392f86bd0f24cf5cc2eb92cb68bc70be94e21318d',
  'link_existing_student_account_atomic(uuid,text,text,text,text,text,text,uuid,text)': '2d552ab39b5a16e37b8b7a67743f1136856fdf19bac9e805dc78f18956b344c6',
  'update_student_profile_nis_audited_atomic(uuid,text,text,text,text,text,text,uuid,text)': '8fe5ef3919125da8fbea1a8f7b0525a1beaa8502ba70cfff08f131e9f9d91782',
  'validate_contest_deadline_future()': '3690946ab68b706de32d872ffaf509d4c0d131204c6e40a7a4e22f96396bd4f6',
};
const NEW_RPC = 'update_student_profile_nis_audited_atomic(uuid,text,text,text,text,text,text,uuid,text)';
const NEW_SECURITY_NAME = NEW_RPC.slice(0, 63);
const COLUMNS = ['contests.tanggal_lomba', 'students.nis'];
export const OPTIONAL_FIELDS_POLICY = 'student-nis-contest-deadline-reviewed-v1';
const hash = (s: string): string => createHash('sha256').update(s).digest('hex');
const fail = (): never => { throw new DeploymentGateError('OPTIONAL_FIELDS_SCHEMA_OR_SECURITY_DRIFT'); };

/** Production's reviewed history differs from DEV; never repair either ledger. */
export async function requireOptionalFieldsProductionHistory(db: WriterSession): Promise<void> {
  const rows = (await db.query(`SELECT version,name FROM supabase_migrations.schema_migrations
    WHERE version=ANY($1::text[]) OR name=ANY($2::text[]) ORDER BY version`, [
    ['20261106141216', '20261107034531'], ['student_optional_nis', 'contest_optional_deadline_emergency'],
  ])).rows;
  if (JSON.stringify(rows) !== JSON.stringify([
    { version: '20261106141216', name: 'student_optional_nis' },
    { version: '20261107034531', name: 'contest_optional_deadline_emergency' },
  ])) throw new DeploymentGateError('OPTIONAL_FIELDS_PRODUCTION_HISTORY_MISMATCH');
}

/** Reconstruct only the reviewed pre-change catalog. The caller MUST compare its
 * full hash with the previously attested student-photo afterCatalogSha256. */
export function optionalFieldsBaseline(catalog: WriterCatalog, snapshot: SchemaSnapshot): WriterCatalog {
  for (const [signature, expected] of Object.entries(FUNCTIONS)) {
    const rows = catalog.inventory.structure.filter(row => row.kind === 'function' && row.name === signature);
    if (rows.length !== 1 || typeof rows[0].definition !== 'string' || hash(rows[0].definition) !== expected) fail();
  }
  for (const name of COLUMNS) {
    const rows = catalog.inventory.structure.filter(row => row.kind === 'column' && row.name === name);
    if (rows.length !== 1 || typeof rows[0].definition !== 'string') fail();
    const value = JSON.parse(String(rows[0].definition)) as Record<string, unknown>;
    if (value.notNull !== false) fail();
  }
  const added = catalog.security.filter(row => row.kind === 'function' && row.name === NEW_SECURITY_NAME);
  if (added.length !== 1 || typeof added[0].metadata !== 'string') fail();
  const meta = JSON.parse(String(added[0].metadata)) as Record<string, unknown>;
  if (meta.owner !== 'postgres' || JSON.stringify(meta.config) !== JSON.stringify(['search_path=""'])
    || JSON.stringify(meta.acl) !== JSON.stringify(['postgres=X/postgres', 'service_role=X/postgres'])
    || Object.keys(meta).sort().join(',') !== 'acl,config,owner') fail();
  const structure = catalog.inventory.structure.filter(row => !(row.kind === 'function' && row.name === NEW_RPC)).map(row => {
    if (row.kind === 'column' && COLUMNS.includes(String(row.name))) {
      const definition = String(row.definition).replace('"notNull": false', '"notNull": true');
      if (definition === row.definition) fail();
      return { ...row, definition };
    }
    if (row.kind === 'function' && Object.hasOwn(FUNCTIONS, String(row.name))) {
      const old = snapshot.functions.filter(f => f.signature === row.name);
      if (old.length !== 1) fail();
      let definition = old[0].definition;
      if (row.name === 'validate_contest_deadline_future()') {
        const before = definition;
        definition = definition.replace('\nAS $function$', "\n SET search_path TO 'pg_catalog', 'public', 'pg_temp'\nAS $function$");
        if (before === definition) fail();
      }
      return { ...row, definition };
    }
    return row;
  });
  return { inventory: { ...catalog.inventory, structure }, security: catalog.security.filter(row => row !== added[0]) };
}

/** Supply the proven pre-change view to every existing verifier, without
 * intercepting privilege, policy, reference-data or managed-schema queries. */
export function optionalFieldsBaselineSession(db: WriterSession, baseline: WriterCatalog, snapshot: SchemaSnapshot): WriterSession {
  return {
    inventory: async () => baseline.inventory,
    async query(sql, values) {
      const result = await db.query(sql, values);
      if (sql.includes('SELECT kind,name,metadata')) return { rows: [...baseline.security] };
      if (!sql.includes('p.prosrc AS body')) return result;
      const rows = result.rows.filter(row => row.signature !== NEW_RPC).map(row => {
        if (typeof row.signature !== 'string' || !Object.hasOwn(FUNCTIONS, row.signature)) return row;
        const match = snapshot.functions.filter(f => f.signature === row.signature);
        if (match.length !== 1) return fail();
        const f = match[0], definition = baseline.inventory.structure.find(item => item.kind === 'function' && item.name === f.signature)?.definition;
        const body = /AS (\$[A-Za-z_0-9]*\$)([\s\S]*)\1\s*$/.exec(f.definition)?.[2];
        if (typeof definition !== 'string' || body === undefined) return fail();
        const path = f.config?.find(c => c.startsWith('search_path='))?.slice('search_path='.length);
        const expectedPath = !path ? 'pg_catalog, public, pg_temp' : path === '""' ? '""' : path.includes('pg_temp') ? path : path + ', pg_temp';
        const config = [...(f.config ?? []).filter(c => !c.startsWith('search_path=')), 'search_path=' + expectedPath];
        return { ...row, body, definer: f.securityDefiner, config, definition };
      });
      return { rows };
    },
  };
}
