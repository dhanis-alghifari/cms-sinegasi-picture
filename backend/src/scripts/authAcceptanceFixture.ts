import { randomBytes } from 'node:crypto';
import { ROLE_CAPABILITIES } from '../middleware/capabilities.js';
import { hashPassword } from '../services/passwordService.js';

// Reserved domain, synthetic key, no socket or forwarding transport.
export const AUTH_FIXTURE_ORIGIN = 'https://auth-acceptance.invalid';
export const AUTH_FIXTURE_KEY = 'sb_secret_isolated_auth_fixture_never_live';
export const AUTH_FIXTURE_USER_ID = '11111111-1111-4111-8111-111111111111';

export class AuthAcceptanceError extends Error {
  constructor(public readonly stage: string) { super(stage); }
}

export function requireAuthAcceptanceArguments(args: readonly string[]): 'plan' | 'rehearse' {
  if (args.length !== 1 || (args[0] !== 'plan' && args[0] !== 'rehearse')) {
    throw new AuthAcceptanceError('OFFLINE_PLAN_OR_ISOLATED_REHEARSAL_ONLY');
  }
  return args[0];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AuthAcceptanceError('FIXTURE_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}

function textField(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new AuthAcceptanceError('FIXTURE_FIELD_INVALID');
  return value;
}

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new AuthAcceptanceError('FIXTURE_INTEGER_INVALID');
  return value;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

interface FixtureUser {
  id: string;
  username: string;
  nama: string;
  role: 'teacher';
  password_hash: string;
  is_first_login: boolean;
  is_active: boolean;
  auth_version: number;
}

export interface AuthAcceptanceFixture {
  temporaryPassword: string;
  newPassword: string;
  fetch: typeof globalThis.fetch;
  snapshot(): { version: number; firstLogin: boolean; passwordChanges: number; passwordRpcCalls: number; blocked: number; requests: number;
    abortedRequests: number; blockedStages: readonly string[] };
  failNextPasswordChange(): void;
  setIdentityUnavailable(unavailable: boolean): void;
  setLimiterUnavailable(unavailable: boolean): void;
}

/** Models only the reviewed REST contract in memory; NOT proof of SQL/RLS/trigger atomicity. */
export async function createAuthAcceptanceFixture(): Promise<AuthAcceptanceFixture> {
  const temporaryPassword = `Fixture-${randomBytes(24).toString('base64url')}-1`;
  const newPassword = `Changed-${randomBytes(24).toString('base64url')}-2`;
  const user: FixtureUser = {
    id: AUTH_FIXTURE_USER_ID, username: 'fixture_guru', nama: 'Guru Terisolasi', role: 'teacher',
    password_hash: await hashPassword(temporaryPassword), is_first_login: true, is_active: true, auth_version: 1,
  };
  const loginCounters = new Map<string, { count: number; expiresAt: number }>();
  const apiCounters = new Map<string, { count: number; resetAt: number }>();
  let passwordChanges = 0, passwordRpcCalls = 0, blocked = 0, requests = 0;
  let abortedRequests = 0;
  const blockedStages = new Set<string>();
  let passwordConflict = false, identityUnavailable = false, limiterUnavailable = false;
  const permissions = Object.entries(ROLE_CAPABILITIES).flatMap(([role_key, capabilities]) =>
    capabilities.map(permission_key => ({ role_key, permission_key })));

  function rowsFor(request: Request, url: URL): Response {
    const table = url.pathname.slice('/rest/v1/'.length);
    let rows: Array<Record<string, unknown>>;
    if (table === 'users') {
      if (identityUnavailable && !url.searchParams.get('select')?.includes('password_hash')) {
        return json({ code: 'FIXTURE_OUTAGE', message: 'Isolated identity unavailable' }, 503);
      }
      const id = url.searchParams.get('id');
      const username = url.searchParams.get('username');
      if ((!id && !username) || (id && id !== `eq.${user.id}` && id !== `in.(${user.id})`)
        || (username && username !== `eq.${user.username}`)) rows = [];
      else rows = [{ ...user }];
    } else if (table === 'students') {
      if (url.searchParams.get('user_id') !== `eq.${user.id}`) throw new AuthAcceptanceError('FIXTURE_STUDENT_SCOPE_INVALID');
      rows = [];
    } else if (table === 'access_role_permissions') {
      const role = url.searchParams.get('role_key');
      rows = permissions.filter(row => !role || `eq.${row.role_key}` === role);
    } else throw new AuthAcceptanceError('FIXTURE_READ_NOT_ALLOWED');

    const columns = textField(url.searchParams.get('select')).split(',');
    if (columns.some(column => !/^[a-z_]+$/.test(column))) throw new AuthAcceptanceError('FIXTURE_PROJECTION_INVALID');
    const projected = rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
    // supabase-js maybeSingle GET uses an array response and resolves zero/one rows itself.
    return request.headers.get('accept')?.includes('application/vnd.pgrst.object+json')
      ? json(projected[0] ?? null) : json(projected);
  }

  async function rpcFor(request: Request, url: URL): Promise<Response> {
    const rpc = url.pathname.slice('/rest/v1/rpc/'.length);
    const args = record(await request.json());
    if (rpc === 'change_password_atomic') {
      passwordRpcCalls += 1;
      if (args.p_user_id !== user.id || args.p_updated_by !== user.id
        || typeof args.p_password_hash !== 'string' || !args.p_password_hash.startsWith('scrypt$')
        || args.p_change_reason !== 'Pengguna mengganti password akun') throw new AuthAcceptanceError('FIXTURE_PASSWORD_SCOPE_INVALID');
      if (passwordConflict || args.p_expected_auth_version !== user.auth_version) {
        passwordConflict = false;
        return json({ code: 'P0001', message: 'Sesi keamanan berubah. Silakan login kembali.' }, 400);
      }
      user.password_hash = args.p_password_hash;
      user.is_first_login = false;
      user.auth_version += 1;
      passwordChanges += 1;
      return json({ id: user.id, nama: user.nama, is_active: user.is_active,
        is_first_login: user.is_first_login, auth_version: user.auth_version });
    }
    if (limiterUnavailable) return json({ code: 'FIXTURE_OUTAGE', message: 'Isolated limiter unavailable' }, 503);
    const key = textField(args.p_rate_key);
    if (!/^[a-f0-9]{64}$/.test(key)) throw new AuthAcceptanceError('FIXTURE_RATE_KEY_INVALID');
    const now = Date.now();
    if (rpc === 'clear_login_rate_limit') { loginCounters.delete(key); return new Response(null, { status: 204 }); }
    if (rpc === 'is_login_rate_limited' || rpc === 'record_login_failure') {
      const windowMs = positiveInteger(args.p_window_seconds) * 1000;
      let counter = loginCounters.get(key);
      if (counter && counter.expiresAt <= now) { loginCounters.delete(key); counter = undefined; }
      if (rpc === 'is_login_rate_limited') return json((counter?.count ?? 0) >= positiveInteger(args.p_max_attempts));
      loginCounters.set(key, { count: (counter?.count ?? 0) + 1, expiresAt: counter?.expiresAt ?? now + windowMs });
      return new Response(null, { status: 204 });
    }
    if (rpc === 'consume_api_rate_limit_atomic') {
      const limit = positiveInteger(args.p_max_requests), windowMs = positiveInteger(args.p_window_seconds) * 1000;
      const stored = apiCounters.get(key);
      const counter = stored && stored.resetAt > now ? stored : { count: 0, resetAt: (Math.floor(now / windowMs) + 1) * windowMs };
      counter.count += 1; apiCounters.set(key, counter);
      return json({ allowed: counter.count <= limit, limit, remaining: Math.max(0, limit - counter.count),
        reset_at: new Date(counter.resetAt).toISOString() });
    }
    throw new AuthAcceptanceError('FIXTURE_RPC_NOT_ALLOWED');
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    try {
      if (requests >= 250) throw new AuthAcceptanceError('FIXTURE_REQUEST_BUDGET_EXCEEDED');
      const request = new Request(input, init), url = new URL(request.url);
      if (request.signal.aborted) throw new AuthAcceptanceError('FIXTURE_REQUEST_ABORTED');
      if (url.origin !== AUTH_FIXTURE_ORIGIN || url.username || url.password || url.hash
        || request.headers.get('apikey') !== AUTH_FIXTURE_KEY
        || ['accept-profile', 'content-profile'].some(header => {
          const value = request.headers.get(header); return value !== null && value !== 'public';
        })) throw new AuthAcceptanceError('FIXTURE_TARGET_BARRIER');
      requests += 1;
      if (request.method === 'GET' && url.pathname.startsWith('/rest/v1/') && !url.pathname.includes('/rpc/')) return rowsFor(request, url);
      if (request.method === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) return await rpcFor(request, url);
      throw new AuthAcceptanceError('FIXTURE_MUTATION_BARRIER');
    } catch (error) {
      const safeError = error instanceof AuthAcceptanceError ? error : new AuthAcceptanceError('FIXTURE_TRANSPORT_FAILED');
      // A simulated outage can exhaust the real SDK's abort timeout. That is cancellation,
      // not an attempt to escape the target/method barrier.
      if (safeError.stage === 'FIXTURE_REQUEST_ABORTED') {
        abortedRequests += 1;
        throw new DOMException('Isolated request aborted', 'AbortError');
      }
      blocked += 1;
      blockedStages.add(safeError.stage);
      throw safeError;
    }
  };
  return {
    temporaryPassword, newPassword, fetch,
    snapshot: () => ({ version: user.auth_version, firstLogin: user.is_first_login, passwordChanges, passwordRpcCalls, blocked, requests,
      abortedRequests, blockedStages: [...blockedStages] }),
    failNextPasswordChange: () => { passwordConflict = true; },
    setIdentityUnavailable: unavailable => { identityUnavailable = unavailable; },
    setLimiterUnavailable: unavailable => { limiterUnavailable = unavailable; },
  };
}
