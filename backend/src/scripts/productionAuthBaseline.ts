import { verifyPassword } from '../services/passwordService.js';
import { sha256 } from './productionReconciliation.js';
import { requireCompletedBootstrapCheckpoint } from './productionBootstrapTeacherCore.js';
import { readWriterCatalog, verifyWriterTarget, writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';
import { readManagedTrigram } from './reconciliationWriterExtensions.js';
import type { WriterPackage } from './reconciliationWriterPolicy.js';
import { AUTH_ACCOUNT, AUTH_MIGRATION_APPROVAL, authRecord, authRequire, type AuthBaseline } from './productionAuthExecutorCore.js';

const VOLATILE_TABLES = ['users', 'activity_logs', 'api_login_rate_limits', 'api_rate_limit_windows'];
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => JSON.stringify(key) + ':' + stableJson(item)).join(',') + '}';
  return JSON.stringify(value);
}
function requireAuditRedaction(value: unknown): void {
  if (Array.isArray(value)) { for (const item of value) requireAuditRedaction(item); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (['password', 'password_hash', 'token', 'access_token', 'refresh_token', 'secret', 'api_key', 'apikey'].includes(key.toLowerCase())) {
      authRequire(item === '[REDACTED]', 'AUTH_AUDIT_SECRET_NOT_REDACTED');
    } else requireAuditRedaction(item);
  }
}
export function requireAuthAccountState(value: unknown, rotated: boolean): Record<string, unknown> {
  const user = authRecord(value);
  authRequire(user.id === AUTH_ACCOUNT.userId && user.username === AUTH_ACCOUNT.username && user.nama === AUTH_ACCOUNT.nama
    && user.role === 'teacher' && user.is_active === true && user.auth_version === (rotated ? 2 : 1)
    && user.is_first_login === !rotated && typeof user.password_hash === 'string' && user.password_hash.startsWith('scrypt$'),
  'AUTH_OFFICIAL_ACCOUNT_STATE_REQUIRED');
  return user;
}
export function verifyAuthAuditRows(rows: readonly Record<string, unknown>[], rotated: boolean): void {
  requireAuditRedaction(rows);
  const snapshot = { id: AUTH_ACCOUNT.userId, username: AUTH_ACCOUNT.username, nama: AUTH_ACCOUNT.nama, role: 'teacher',
    is_first_login: true, is_active: true, auth_version: 1 };
  const bootstrap = rows.filter(row => row.source === 'bootstrap');
  authRequire(rows.length === (rotated ? 3 : 1) && bootstrap.length === 1 && bootstrap[0].action === 'INSERT'
    && bootstrap[0].old_values === null && stableJson(bootstrap[0].new_values) === stableJson(snapshot)
    && rows.every(row => row.table_name === 'users' && row.record_id === AUTH_ACCOUNT.userId && row.user_id === AUTH_ACCOUNT.userId),
  'AUTH_AUDIT_SCOPE_OR_COUNT_MISMATCH');
  if (!rotated) return;
  const api = rows.filter(row => row.source === 'api'), trigger = rows.filter(row => row.source === 'trigger');
  authRequire(api.length === 1 && trigger.length === 1 && api[0].action === 'UPDATE' && trigger[0].action === 'UPDATE'
    && stableJson(api[0].old_values) === stableJson({ auth_version: 1 })
    && stableJson(api[0].new_values) === stableJson({ operation: 'change_password', auth_version: 2 })
    && authRecord(trigger[0].old_values).auth_version === 1 && authRecord(trigger[0].new_values).auth_version === 2,
  'AUTH_PASSWORD_AUDIT_CONTRACT_MISMATCH');
}

/** Read-only account-aware inspection. No login, hash migration or SQL package application. */
export async function readAuthBaseline(db: WriterSession, bundle: WriterPackage, rotated = false, allowCounterWrites = false): Promise<{
  baseline: AuthBaseline; user: Record<string, unknown>; bootstrapAuditSha256: string;
}> {
  const checkpoint = await requireCompletedBootstrapCheckpoint(db, bundle);
  authRequire(checkpoint.migrationApprovalSha256 === AUTH_MIGRATION_APPROVAL, 'AUTH_COMPLETED_CHECKPOINT_REQUIRED');
  const catalog = await readWriterCatalog(db), managed = await readManagedTrigram(db);
  const count = (name: string) => catalog.inventory.tables.find(t => t.name === name)?.rows;
  authRequire(count('users') === '1' && count('activity_logs') === (rotated ? '3' : '1')
    && (rotated || allowCounterWrites || count('api_login_rate_limits') === '0' && count('api_rate_limit_windows') === '0'), 'AUTH_INITIAL_OR_POST_ROW_COUNTS');
  const normalized = { ...catalog.inventory, tables: catalog.inventory.tables.map(t => VOLATILE_TABLES.includes(t.name) ? { ...t, rows: '0' } : t) };
  // Other checks still query the real db (policies/functions/reference rows/permissions).
  const target = await verifyWriterTarget({ query: db.query.bind(db), inventory: async () => normalized }, bundle.snapshot, bundle.reference, managed.sha256);
  authRequire(writerCatalogHash(target) === checkpoint.targetCatalogSha256, 'AUTH_SCHEMA_SECURITY_OR_BUSINESS_DATA_DRIFT');
  const managedCounts = (await db.query(`SELECT (SELECT count(*)::text FROM auth.users) AS accounts,
    (SELECT count(*)::text FROM storage.objects) AS objects`)).rows[0];
  authRequire(managedCounts?.accounts === '0' && managedCounts.objects === '0', 'AUTH_MANAGED_DATA_CHANGED');
  const users = (await db.query('SELECT to_jsonb(u) AS data FROM public.users u ORDER BY id')).rows;
  authRequire(users.length === 1, 'AUTH_EXACTLY_ONE_USER_REQUIRED');
  const user = requireAuthAccountState(users[0].data, rotated);
  const audits = (await db.query('SELECT to_jsonb(a) AS data FROM public.activity_logs a ORDER BY id')).rows.map(row => authRecord(row.data));
  verifyAuthAuditRows(audits, rotated);
  return { baseline: { catalogSha256: writerCatalogHash(catalog), inventorySha256: sha256(JSON.stringify(catalog.inventory)),
    accountAuditSha256: sha256(stableJson([user, audits])), managedExtensionSha256: managed.sha256, ...checkpoint }, user,
    bootstrapAuditSha256: sha256(stableJson(audits.find(row => row.source === 'bootstrap'))) };
}

export async function requireRotatedPassword(user: Record<string, unknown>, temporary: string, current: string): Promise<void> {
  requireAuthAccountState(user, true);
  authRequire(typeof user.password_hash === 'string' && (await verifyPassword(current, user.password_hash)).valid
    && !(await verifyPassword(temporary, user.password_hash)).valid, 'AUTH_DATABASE_PASSWORD_POSTCONDITION');
}
