import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { SchemaSnapshot } from './productionReconciliation.js';
import type { ReferenceDataPlan } from './productionReferenceData.js';

export const INTEGRATION_PROJECT = 'pvbdiftvzoeelibxlxzb';
export const INTEGRATION_ORIGIN = `https://${INTEGRATION_PROJECT}.supabase.co`;
export const INTEGRATION_SERVICE_KEY = 'sinegasi-prod-supabase-service-role-key';
export const INTEGRATION_PUBLIC_KEY = 'sinegasi-prod-supabase-publishable-key';
export const INTEGRATION_PRIVATE_JOURNALS = ['agenda_migration_history', 'borrowing_migration_history',
  'cash_migration_history', 'contest_migration_history', 'schema_migrations'] as const;
const READ_RPCS = ['get_operational_dashboard_summary', 'get_attendance_summary_filtered', 'is_login_rate_limited'] as const;

export class ManagedIntegrationError extends Error {
  constructor(public readonly stage: string) { super(stage); this.name = 'ManagedIntegrationError'; }
}

export function requireIntegrationArguments(args: readonly string[]): 'plan' | 'check' {
  if (args.length === 1 && args[0] === 'plan') return 'plan';
  if (args.length === 3 && args[0] === 'check' && args[1] === '--confirm-project' && args[2] === INTEGRATION_PROJECT) return 'check';
  throw new ManagedIntegrationError('USE_PLAN_OR_CHECK_WITH_EXACT_PRODUCTION_PROJECT');
}

/** Local format/role guard only; the managed gateway verifies authenticity and project binding. */
export function validateIntegrationKey(raw: string, role: 'service_role' | 'anon', now = Date.now()): string {
  const key = raw.trim();
  const prefix = role === 'service_role' ? 'sb_secret_' : 'sb_publishable_';
  if (new RegExp(`^${prefix}[A-Za-z0-9_-]{16,128}$`).test(key)) return key;
  try {
    if (key.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) throw new Error();
    const payload: unknown = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    const value = integrationRecord(payload);
    if (value.role !== role || value.ref !== INTEGRATION_PROJECT || typeof value.exp !== 'number'
      || !Number.isSafeInteger(value.exp) || value.exp * 1000 <= now) throw new Error();
    return key;
  } catch { throw new ManagedIntegrationError('API_KEY_ROLE_PROJECT_OR_FORMAT_INVALID'); }
}

export function integrationRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ManagedIntegrationError('RESPONSE_SHAPE_INVALID');
  return value as Record<string, unknown>;
}

export interface ReadOnlyTransport {
  fetch: typeof fetch;
  observations: { sent: number; blocked: number };
}

/** Enforced before any network I/O, also used by the real application singleton.
 * GET RPCs run in PostgREST read-only transactions. No Auth/Storage/realtime endpoints are allowed.
 */
export function createReadOnlyTransport(relations: readonly string[], upstream: typeof fetch = fetch): ReadOnlyTransport {
  if (relations.some(name => !/^[a-z_][a-z0-9_]*$/.test(name))) throw new ManagedIntegrationError('RELATION_ALLOWLIST_INVALID');
  const paths = new Set(['/rest/v1/', ...relations.map(name => `/rest/v1/${name}`), ...READ_RPCS.map(name => `/rest/v1/rpc/${name}`)]);
  const observations = { sent: 0, blocked: 0 };
  const guarded: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method) || request.body !== null
      || url.origin !== INTEGRATION_ORIGIN || url.username || url.password || url.hash || !paths.has(url.pathname)
      || ['accept-profile', 'content-profile'].some(name => {
        const profile = request.headers.get(name); return profile !== null && profile !== 'public';
      })) {
      observations.blocked++;
      throw new ManagedIntegrationError('READ_ONLY_REQUEST_BARRIER');
    }
    if (observations.sent >= 300) throw new ManagedIntegrationError('REQUEST_BUDGET_EXCEEDED');
    observations.sent++;
    // Never follow a redirect with a privileged apikey/Authorization header.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000)]);
    const response = await upstream(request, { redirect: 'error', signal });
    if (response.redirected || (response.url && new URL(response.url).origin !== INTEGRATION_ORIGIN)) {
      throw new ManagedIntegrationError('UNEXPECTED_RESPONSE_TARGET');
    }
    return response;
  };
  return { fetch: guarded, observations };
}

export function managedReadOnlyClient(key: string, transport: ReadOnlyTransport): SupabaseClient {
  return createClient(INTEGRATION_ORIGIN, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { retry: false },
    global: { fetch: transport.fetch },
  });
}

export function requirePermissionDenial(
  result: { error: { code?: string } | null; status: number }, stage = 'ANON_PERMISSION_DENIAL_NOT_PROVEN',
): void {
  // Invalid keys, an unavailable gateway, and stale schema-cache 404s do NOT prove access denial.
  if (![401, 403].includes(result.status) || result.error?.code !== '42501') {
    throw new ManagedIntegrationError(stage);
  }
}

/** Match the reviewed package: application tables are granted; these journals are deliberately private. */
export function integrationTableAccess(snapshot: SchemaSnapshot): {
  applicationTables: SchemaSnapshot['tables']; migrationJournals: SchemaSnapshot['tables'];
} {
  const privateNames = new Set<string>(INTEGRATION_PRIVATE_JOURNALS);
  const migrationJournals = snapshot.tables.filter(table => privateNames.has(table.relname));
  if (new Set(migrationJournals.map(table => table.relname)).size !== privateNames.size) {
    throw new ManagedIntegrationError('MIGRATION_JOURNAL_INVENTORY_MISMATCH');
  }
  return { applicationTables: snapshot.tables.filter(table => !privateNames.has(table.relname)), migrationJournals };
}

export async function verifyManagedReads(
  service: SupabaseClient, browser: SupabaseClient, snapshot: SchemaSnapshot, reference: ReferenceDataPlan,
  record: (stage: string) => void,
): Promise<void> {
  const { applicationTables, migrationJournals } = integrationTableAccess(snapshot);
  const applicationNames = new Set(applicationTables.map(table => table.relname));
  if (reference.tables.some(table => !applicationNames.has(table.name))) {
    throw new ManagedIntegrationError('REFERENCE_TABLE_NOT_APPLICATION_TABLE');
  }
  const expectedCounts = new Map(reference.tables.map(table => [table.name, table.rows.length]));
  for (const table of applicationTables) {
    const result = await service.from(table.relname).select('*', { head: true, count: 'exact' });
    if (result.error || result.count !== (expectedCounts.get(table.relname) ?? 0)) {
      throw new ManagedIntegrationError('INITIAL_TABLE_COUNTS_OR_DATA_API_SCHEMA_MISMATCH');
    }
  }
  for (const view of snapshot.views) {
    const result = await service.from(view.name).select('*', { head: true, count: 'exact' });
    if (result.error || result.count !== 0) throw new ManagedIntegrationError('INITIAL_VIEW_READ_FAILED');
  }
  record('SERVICE_ROLE_APPLICATION_TABLES_AND_VIEWS_READ');
  for (const table of migrationJournals) {
    // Do not skip private journals or grant access to satisfy the test. GET returns the denial body.
    requirePermissionDenial(await service.from(table.relname).select('*').limit(0),
      'SERVICE_ROLE_MIGRATION_JOURNALS_DENIAL_NOT_PROVEN');
  }
  record('SERVICE_ROLE_MIGRATION_JOURNALS_DENIED');

  for (const table of reference.tables) {
    const result = await service.from(table.name).select(table.columns.join(',')).limit(1000);
    if (result.error || !Array.isArray(result.data)) throw new ManagedIntegrationError('REFERENCE_REST_READ_FAILED');
    const actual = result.data.map((row: unknown) => {
      const value = integrationRecord(row);
      return JSON.stringify(table.columns.map(column => column === 'nominal_iuran_wajib' ? Number(value[column]) : value[column]));
    }).sort();
    if (JSON.stringify(actual) !== JSON.stringify(table.rows.map(row => JSON.stringify(row)).sort())) {
      throw new ManagedIntegrationError('REFERENCE_REST_DATA_DRIFT');
    }
  }
  record('CANONICAL_CONFIGURATION_REST_MATCH');

  const dashboard = await service.rpc('get_operational_dashboard_summary', {}, { get: true });
  if (dashboard.error) throw new ManagedIntegrationError('DASHBOARD_GET_RPC_FAILED');
  const summary = integrationRecord(dashboard.data);
  if (summary.timezone !== 'Asia/Jakarta'
    || integrationRecord(summary.kas).saldoTerakhir !== 0
    || integrationRecord(summary.absensi).totalSiswa !== 0
    || integrationRecord(summary.alat).totalAlat !== 0
    || integrationRecord(summary.gradeDistribution).totalSiswaEvaluated !== 0) {
    throw new ManagedIntegrationError('EMPTY_DASHBOARD_CONTRACT_MISMATCH');
  }
  const attendance = await service.rpc('get_attendance_summary_filtered', {}, { get: true });
  if (attendance.error || !Array.isArray(attendance.data) || attendance.data.length !== 1
    || ['hadir', 'sakit', 'izin', 'alpha', 'total'].some(name => integrationRecord(attendance.data[0])[name] !== 0)) {
    throw new ManagedIntegrationError('ATTENDANCE_GET_RPC_CONTRACT_MISMATCH');
  }
  const rateArgs = { p_rate_key: `readonly-integration-${randomUUID()}`, p_window_seconds: 300, p_max_attempts: 10 };
  const rate = await service.rpc('is_login_rate_limited', rateArgs, { get: true });
  if (rate.error || rate.data !== false) throw new ManagedIntegrationError('LOGIN_LIMIT_READ_RPC_CONTRACT_MISMATCH');
  record('THREE_READ_ONLY_RPC_CONTRACTS');

  for (const relation of [...snapshot.tables.map(table => table.relname), ...snapshot.views.map(view => view.name)]) {
    // HEAD omits the JSON error body and cannot prove SQLSTATE 42501.
    requirePermissionDenial(await browser.from(relation).select('*').limit(0));
  }
  for (const name of READ_RPCS) {
    requirePermissionDenial(await browser.rpc(name, name === 'is_login_rate_limited' ? rateArgs : {}, { get: true }));
  }
  record('ANON_ALL_TABLES_VIEWS_AND_THREE_RPCS_DENIED');
  // Repeat counts after probes, without reading business payloads or exporting user records.
  for (const table of applicationTables) {
    const result = await service.from(table.relname).select('*', { head: true, count: 'exact' });
    if (result.error || result.count !== (expectedCounts.get(table.relname) ?? 0)) {
      throw new ManagedIntegrationError('TABLE_COUNTS_CHANGED_DURING_READ_ONLY_TEST');
    }
  }
  record('INITIAL_TABLE_COUNTS_UNCHANGED');
}
