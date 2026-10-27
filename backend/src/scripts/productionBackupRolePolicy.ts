import { DeploymentGateError } from './productionDeploymentError.js';
import type { WriterCatalog, WriterSession } from './reconciliationWriterCatalog.js';

/** Explicit, reviewed delta only. Never grants privileges or updates history. */
export const APPROVED_BACKUP_ROLE_POLICY = 'sinegasi-backup-readonly-v1';
export type ApprovedBackupRolePolicy = typeof APPROVED_BACKUP_ROLE_POLICY;
const ROLE = 'sinegasi_backup';
function requireRole(condition: unknown): asserts condition {
  if (!condition) throw new DeploymentGateError('APPROVED_BACKUP_ROLE_OR_MEMBERSHIP_DRIFT');
}
const memberships = [
  { role_name: 'pg_read_all_data', member_name: ROLE, grantor_name: 'postgres', admin_option: false, inherit_option: true, set_option: true },
  { role_name: ROLE, member_name: 'postgres', grantor_name: 'supabase_admin', admin_option: true, inherit_option: false, set_option: false },
] as const;
export async function requireApprovedBackupRole(db: WriterSession): Promise<void> {
  const roles = (await db.query(`SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,
    rolreplication,rolbypassrls,rolconnlimit,rolconfig,rolvaliduntil IS NULL AS no_expiry
    FROM pg_catalog.pg_roles WHERE rolname=$1`, [ROLE])).rows;
  const r = roles[0];
  requireRole(roles.length === 1 && r.rolname === ROLE && r.rolsuper === false && r.rolinherit === true
    && r.rolcreaterole === false && r.rolcreatedb === false && r.rolcanlogin === true
    && r.rolreplication === false && r.rolbypassrls === true && r.rolconnlimit === 1
    && r.no_expiry === true && JSON.stringify(r.rolconfig) === JSON.stringify(['default_transaction_read_only=on']));
  const actual = (await db.query(`SELECT r.rolname AS role_name,m.rolname AS member_name,g.rolname AS grantor_name,
    a.admin_option,a.inherit_option,a.set_option FROM pg_catalog.pg_auth_members a
    JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member
    JOIN pg_catalog.pg_roles g ON g.oid=a.grantor WHERE r.rolname=$1 OR m.rolname=$1
    ORDER BY r.rolname,m.rolname`, [ROLE])).rows;
  requireRole(actual.length === memberships.length && memberships.every(expected => actual.filter(row =>
    Object.keys(row).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => row[key] === value)).length === 1));
  const settings = (await db.query(`SELECT count(*)::int AS count FROM pg_catalog.pg_db_role_setting s
    JOIN pg_catalog.pg_roles r ON r.oid=s.setrole WHERE r.rolname=$1 AND s.setdatabase<>0`, [ROLE])).rows;
  requireRole(settings.length === 1 && settings[0].count === 0);
}

/** Used only after live attributes/grantors passed; every other catalog byte remains visible. */
export function withoutApprovedBackupRole(catalog: WriterCatalog): WriterCatalog {
  const roles = catalog.inventory.roles.filter(role => role.name === ROLE);
  requireRole(roles.length === 1 && roles[0].inherit === true && roles[0].bypassRls === true);
  const related = catalog.security.filter(row => row.kind === 'membership'
    && (String(row.name).startsWith(ROLE + ':') || String(row.name).endsWith(':' + ROLE)));
  requireRole(related.length === 2 && memberships.every(expected => related.filter(row => {
    if (row.name !== expected.role_name + ':' + expected.member_name || typeof row.metadata !== 'string') return false;
    let value: unknown;
    try { value = JSON.parse(row.metadata); } catch { return false; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const meta = value as Record<string, unknown>;
    return Object.keys(meta).length === 3 && meta.admin === expected.admin_option
      && meta.inherit === expected.inherit_option && meta.set === expected.set_option;
  }).length === 1));
  return { inventory: { ...catalog.inventory, roles: catalog.inventory.roles.filter(role => role.name !== ROLE) },
    security: catalog.security.filter(row => !related.includes(row)) };
}
