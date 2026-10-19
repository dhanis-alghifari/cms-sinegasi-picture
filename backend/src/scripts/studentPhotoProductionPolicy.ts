import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DeploymentGateError } from './productionDeploymentError.js';
import type { WriterCatalog, WriterSession } from './reconciliationWriterCatalog.js';

export const STUDENT_PHOTO_CHANGE = 'add-student-photo-audit-rpc-v1';
export const STUDENT_PHOTO_SQL_SHA256 = '432bfd1fa8894f7aa554eeabfcab98923563ae30737b26232b5e631d35096613';
export const STUDENT_PHOTO_SIGNATURE = 'update_student_profile_audited_atomic(uuid,text,text,text,text,text,uuid,text)';
export const studentPhotoHash = (raw: string): string => createHash('sha256').update(raw).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const requirePhoto: (condition: unknown, code: string) => asserts condition = (condition, code) => {
  if (!condition) throw new DeploymentGateError(code);
};

export interface StudentPhotoReceipt {
  operation: typeof STUDENT_PHOTO_CHANGE;
  sqlSha256: typeof STUDENT_PHOTO_SQL_SHA256;
  releaseSha: string;
  approvalSha256: string;
  baselineEvidenceSha256: string;
  rehearsalSha256: string;
  beforeCatalogSha256: string;
  afterCatalogSha256: string;
  appliedAt: string;
}

export function validateStudentPhotoReceipt(value: unknown, afterHash: string, observedAt: string): StudentPhotoReceipt {
  requirePhoto(value !== null && typeof value === 'object' && !Array.isArray(value), 'PHOTO_MIGRATION_RECEIPT_REQUIRED');
  const item = value as Record<string, unknown>;
  const keys = ['operation', 'sqlSha256', 'releaseSha', 'approvalSha256', 'baselineEvidenceSha256', 'rehearsalSha256',
    'beforeCatalogSha256', 'afterCatalogSha256', 'appliedAt'];
  requirePhoto(Object.keys(item).length === keys.length && keys.every(key => Object.hasOwn(item, key))
    && item.operation === STUDENT_PHOTO_CHANGE && item.sqlSha256 === STUDENT_PHOTO_SQL_SHA256
    && typeof item.releaseSha === 'string' && SHA.test(item.releaseSha)
    && ['approvalSha256', 'baselineEvidenceSha256', 'rehearsalSha256', 'beforeCatalogSha256', 'afterCatalogSha256']
      .every(key => typeof item[key] === 'string' && HASH.test(item[key]))
    && item.afterCatalogSha256 === afterHash && item.beforeCatalogSha256 !== item.afterCatalogSha256,
  'PHOTO_MIGRATION_RECEIPT_BINDING_MISMATCH');
  const time = typeof item.appliedAt === 'string' ? Date.parse(item.appliedAt) : NaN;
  requirePhoto(Number.isFinite(time) && new Date(time).toISOString() === item.appliedAt
    && time <= Date.parse(observedAt), 'PHOTO_MIGRATION_RECEIPT_TIME_INVALID');
  return item as unknown as StudentPhotoReceipt;
}

/** Fixed repository SQL only. No arbitrary path, inline SQL, historical runner or override. */
export async function readStudentPhotoSql(): Promise<string> {
  const sql = await readFile(resolve(__dirname, '../../src/migrations/090_student_profile_audit_context.sql'), 'utf8');
  requirePhoto(studentPhotoHash(sql) === STUDENT_PHOTO_SQL_SHA256, 'PHOTO_MIGRATION_SQL_CHECKSUM_MISMATCH');
  return sql;
}

export async function requireStudentPhotoAbsent(db: WriterSession): Promise<void> {
  const rows = (await db.query(`SELECT count(*)::int AS count FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='update_student_profile_audited_atomic'`)).rows;
  requirePhoto(rows.length === 1 && rows[0].count === 0, 'PHOTO_MIGRATION_ALREADY_PRESENT_INSPECT_DO_NOT_RETRY');
}

/** Verify all executable attributes, body and exact ACL before excluding ONE approved addition. */
export async function requireStudentPhotoFunction(db: WriterSession, sql: string): Promise<void> {
  requirePhoto(studentPhotoHash(sql) === STUDENT_PHOTO_SQL_SHA256, 'PHOTO_MIGRATION_SQL_CHECKSUM_MISMATCH');
  const body = /AS \$\$([\s\S]*?)\$\$;/.exec(sql)?.[1];
  const rows = (await db.query(`SELECT p.prosrc AS body,p.prosecdef AS definer,p.proconfig AS config,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner,l.lanname AS language,p.prokind AS kind,
    p.provolatile AS volatility,p.proisstrict AS strict,p.proleakproof AS leakproof,p.proparallel AS parallel,
    p.proretset AS returns_set,p.prorettype::pg_catalog.regtype::text AS result,p.pronargdefaults AS defaults,
    p.procost AS cost,p.prorows AS result_rows,p.prosupport::pg_catalog.regproc::text AS support,
    p.probin AS binary,p.prosqlbody AS sql_body,p.provariadic::int AS variadic,p.protrftypes::text AS transforms,
    EXISTS(SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_proc'::pg_catalog.regclass
      AND d.objid=p.oid AND d.deptype='e') AS extension_owned,
    p.proargnames AS argument_names,p.proargmodes AS argument_modes,
    pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
    pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC'
      ELSE pg_catalog.pg_get_userbyid(a.grantee) END,'grantor',pg_catalog.pg_get_userbyid(a.grantor),
      'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee)
      FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a) AS acl,
    (SELECT count(*)::int FROM pg_catalog.pg_proc other WHERE other.pronamespace=p.pronamespace
      AND other.proname=p.proname) AS overloads
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE p.oid=pg_catalog.to_regprocedure($1)`, ['public.' + STUDENT_PHOTO_SIGNATURE])).rows;
  const f = rows[0];
  const acl = f?.acl;
  const names = ['p_student_id', 'p_nama', 'p_kelas', 'p_peminatan', 'p_no_telepon', 'p_foto_url', 'p_updated_by', 'p_change_reason'];
  requirePhoto(rows.length === 1 && body !== undefined && f.body === body && f.definer === false
    && JSON.stringify(f.config) === JSON.stringify(['search_path=""']) && f.owner === 'postgres'
    && f.language === 'plpgsql' && f.kind === 'f' && f.volatility === 'v' && f.strict === false
    && f.leakproof === false && f.parallel === 'u' && f.returns_set === false && f.result === 'jsonb'
    && f.defaults === 0 && f.cost === 100 && f.result_rows === 0 && f.support === '-'
    && f.binary === null && f.sql_body === null && f.variadic === 0 && f.transforms === null && f.extension_owned === false
    && JSON.stringify(f.argument_names) === JSON.stringify(names) && f.argument_modes === null
    && f.overloads === 1 && f.anon_execute === false && f.authenticated_execute === false
    && f.service_execute === true && Array.isArray(acl) && acl.length === 2
    && ['postgres', 'service_role'].every(grantee => acl.filter((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const a = entry as Record<string, unknown>;
      return a.grantee === grantee && a.grantor === 'postgres' && a.privilege === 'EXECUTE' && a.grantable === false;
    }).length === 1),
  'PHOTO_MIGRATION_FUNCTION_OR_ACL_MISMATCH');
}

export function withoutStudentPhotoCatalog(catalog: WriterCatalog): WriterCatalog {
  return { inventory: { ...catalog.inventory, structure: catalog.inventory.structure.filter(row =>
    !(row.kind === 'function' && row.name === STUDENT_PHOTO_SIGNATURE)) },
  security: catalog.security.filter(row => !(row.kind === 'function' && row.name === STUDENT_PHOTO_SIGNATURE)) };
}

/** Internal Adapter: keep the original verifier unchanged, including every other object/ACL. */
export function withoutStudentPhotoSession(db: WriterSession): WriterSession {
  return {
    async inventory() {
      const inventory = await db.inventory();
      return withoutStudentPhotoCatalog({ inventory, security: [] }).inventory;
    },
    async query(sql, values) {
      const result = await db.query(sql, values);
      if (sql.includes('SELECT kind,name,metadata')) return {
        rows: result.rows.filter(row => !(row.kind === 'function' && row.name === STUDENT_PHOTO_SIGNATURE)),
      };
      if (sql.includes('p.prosrc AS body')) return { rows: result.rows.filter(row => row.signature !== STUDENT_PHOTO_SIGNATURE) };
      return result;
    },
  };
}
