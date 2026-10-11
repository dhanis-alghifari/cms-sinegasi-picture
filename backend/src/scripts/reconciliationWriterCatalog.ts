import type { DatabaseInventory } from './productionBackupCore.js';
import { canonicalConstraintDefinition, sha256, type SchemaSnapshot } from './productionReconciliation.js';
import { verifyReferenceRows, type ReferenceDatabase, type ReferenceDataPlan } from './productionReferenceData.js';
import { WriterError } from './reconciliationWriterPolicy.js';

export interface WriterSession extends ReferenceDatabase {
  inventory(): Promise<DatabaseInventory>;
}
export interface WriterCatalog { inventory: DatabaseInventory; security: ReadonlyArray<Record<string, unknown>> }

/** Include ACLs/options/default privileges and role membership in the review hash.
 * Private run receipts are deliberately excluded to avoid a circular digest.
 */
export async function readWriterCatalog(db: WriterSession): Promise<WriterCatalog> {
  const inventory = await db.inventory();
  const security = (await db.query(`SELECT kind,name,metadata FROM (
    SELECT 'relation' AS kind,c.relname AS name,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'options',c.reloptions,'kind',c.relkind)::text AS metadata
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT 'function',p.oid::regprocedure::text,jsonb_build_object('owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig)::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    UNION ALL SELECT 'schema',n.nspname,jsonb_build_object('owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl)::text FROM pg_namespace n WHERE n.nspname='public'
    UNION ALL SELECT 'default-acl',pg_get_userbyid(d.defaclrole)::text||':'||d.defaclobjtype::text,d.defaclacl::text
      FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='public'
    UNION ALL SELECT 'membership',r.rolname::text||':'||m.rolname::text,jsonb_build_object('admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option)::text
      FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
  ) objects ORDER BY kind COLLATE "C",name COLLATE "C",metadata COLLATE "C"`)).rows;
  return { inventory, security };
}
export function writerCatalogHash(catalog: WriterCatalog): string { return sha256(JSON.stringify(catalog)); }
const sorted = (values: readonly unknown[]): string => JSON.stringify(values.map(value => JSON.stringify(value)).sort());
const requireEqual = (actual: readonly unknown[], expected: readonly unknown[], stage: string): void => {
  if (sorted(actual) !== sorted(expected)) throw new WriterError(stage);
};

/** Exact postcondition, including bodies/constraints/permissions; not just table counts. */
export async function verifyWriterTarget(db: WriterSession, snapshot: SchemaSnapshot, reference: ReferenceDataPlan): Promise<WriterCatalog> {
  const catalog = await readWriterCatalog(db), inventory = catalog.inventory;
  if (catalog.security.some(item => item.kind === 'relation' && !['r', 'v', 'i'].includes(String((JSON.parse(String(item.metadata)) as Record<string, unknown>).kind)))) {
    throw new WriterError('TARGET_UNEXPECTED_RELATION_KIND');
  }
  if (!inventory.roles.some(role => role.name === 'service_role' && role.bypassRls)) throw new WriterError('TARGET_SERVICE_ROLE_RLS_IDENTITY_MISMATCH');
  requireEqual(inventory.tables.map(t => [t.schema, t.name, t.rows, t.rls, t.forceRls]), snapshot.tables.map(t =>
    ['public', t.relname, String(reference.tables.find(r => r.name === t.relname)?.rows.length ?? 0), true, false]), 'TARGET_TABLE_ROWS_RLS_MISMATCH');
  const columns = inventory.structure.filter(o => o.kind === 'column' && !snapshot.views.some(v => String(o.name).startsWith(v.name + '.'))).map(o => {
    const d = JSON.parse(String(o.definition)) as Record<string, unknown>;
    return [o.name, d.type, d.notNull, d.default, d.identity, d.generated];
  });
  requireEqual(columns, snapshot.tables.flatMap(t => t.columns.map(c => [t.relname + '.' + c.name, c.type, c.notNull, c.default, c.identity, ''])), 'TARGET_COLUMNS_MISMATCH');
  requireEqual(inventory.structure.filter(o => o.kind === 'constraint').map(o => [o.name, canonicalConstraintDefinition(String(o.name), String(o.definition))]),
    snapshot.constraints.map(c => [c.table + '.' + c.name, canonicalConstraintDefinition(c.table + '.' + c.name, c.definition)]), 'TARGET_CONSTRAINTS_MISMATCH');
  for (const [kind, expected] of [
    ['enum', snapshot.enums.map(e => [e.name, JSON.stringify(e.labels)])],
    ['trigger', snapshot.triggers.map(t => [t.table + '.' + t.name, t.definition.trim()])],
    ['view', snapshot.views.map(v => [v.name, v.definition.trim()])],
  ] as const) {
    requireEqual(inventory.structure.filter(o => o.kind === kind).map(o => [o.name,
      kind === 'enum' ? JSON.stringify(JSON.parse(String(o.definition))) : String(o.definition).trim()]), expected, 'TARGET_' + kind.toUpperCase() + '_MISMATCH');
  }
  const indexes = (await db.query(`SELECT c.relname AS name,pg_get_indexdef(c.oid) AS definition FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'
    AND NOT EXISTS(SELECT 1 FROM pg_constraint co WHERE co.conindid=c.oid)`)).rows;
  requireEqual(indexes.map(i => [i.name, i.definition]), snapshot.indexes.map(i => [i.name, i.definition]), 'TARGET_INDEXES_MISMATCH');
  const policies = (await db.query(`SELECT tablename AS "table",policyname AS name,permissive,roles::text AS roles,cmd,qual,with_check AS "check"
    FROM pg_policies WHERE schemaname='public'`)).rows;
  const policyTuple = (p: Record<string, unknown>) => [p.table, p.name, p.permissive, p.roles, p.cmd, p.qual, p.check];
  requireEqual(policies.map(policyTuple), snapshot.policies.map(p => policyTuple({ ...p })), 'TARGET_POLICIES_MISMATCH');
  const views = (await db.query(`SELECT c.relname AS name,c.reloptions AS options FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'`)).rows;
  if (views.some(v => !Array.isArray(v.options) || !v.options.includes('security_invoker=true'))) throw new WriterError('TARGET_UNSAFE_VIEW');
  const bodies = (await db.query(`SELECT p.oid::regprocedure::text AS signature,p.prosrc AS body,p.prosecdef AS definer,p.proconfig AS config
    ,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`)).rows;
  if (bodies.length !== snapshot.functions.length) throw new WriterError('TARGET_FUNCTION_COUNT_MISMATCH');
  for (const f of snapshot.functions) {
    const actual = bodies.find(b => b.signature === f.signature);
    const match = /AS (\$[A-Za-z_0-9]*\$)([\s\S]*)\1\s*$/.exec(f.definition);
    const path = f.config?.find(c => c.startsWith('search_path='))?.slice('search_path='.length);
    const expectedPath = !path ? 'pg_catalog, public, pg_temp' : path === '""' ? '""' : path.includes('pg_temp') ? path : path + ', pg_temp';
    const expectedConfig = [...(f.config ?? []).filter(c => !c.startsWith('search_path=')), 'search_path=' + expectedPath];
    const withoutSearchPath = (definition: string) => definition.replace(/^ SET search_path TO .*\n/gm, '').replaceAll('\r\n', '\n').trim();
    if (!match || typeof actual?.body !== 'string' || actual.body.replaceAll('\r\n', '\n') !== match[2].replaceAll('\r\n', '\n')
      || actual.definer !== f.securityDefiner || !Array.isArray(actual.config) || sorted(actual.config) !== sorted(expectedConfig)
      || typeof actual.definition !== 'string' || withoutSearchPath(actual.definition) !== withoutSearchPath(f.definition)) {
      throw new WriterError('TARGET_FUNCTION_SEMANTICS_MISMATCH');
    }
  }
  await verifyReferenceRows(db, reference);
  for (const role of ['anon', 'authenticated']) {
    const result = (await db.query(`SELECT
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v')
        AND (has_table_privilege($1,c.oid,'SELECT') OR has_table_privilege($1,c.oid,'INSERT') OR has_table_privilege($1,c.oid,'UPDATE') OR has_table_privilege($1,c.oid,'DELETE'))) AS tables,
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
        AND has_function_privilege($1,p.oid,'EXECUTE')) AS functions,
      has_schema_privilege($1,'public','CREATE') AS create`, [role])).rows[0];
    if (result?.tables !== false || result.functions !== false || result.create !== false) throw new WriterError('TARGET_BROWSER_ACCESS_EXPOSED');
  }
  for (const t of snapshot.tables) {
    const history = t.relname === 'schema_migrations' || t.relname.endsWith('_migration_history');
    const access = (await db.query(`SELECT has_table_privilege('service_role',$1,'SELECT') AS read,
      has_table_privilege('service_role',$1,'INSERT') AS insert,has_table_privilege('service_role',$1,'UPDATE') AS update,
      has_table_privilege('service_role',$1,'DELETE') AS delete`, ['public.' + t.relname])).rows[0];
    if (!access || Object.values(access).some(value => value !== !history)) throw new WriterError('TARGET_SERVICE_ROLE_ACCESS_MISMATCH');
  }
  const service = (await db.query(`SELECT
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
      AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')) AS missing_rpc,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      AND c.relkind='v' AND NOT has_table_privilege('service_role',c.oid,'SELECT')) AS missing_view`)).rows[0];
  if (service?.missing_rpc !== false || service.missing_view !== false) throw new WriterError('TARGET_SERVICE_RPC_VIEW_ACCESS_MISMATCH');
  return catalog;
}
