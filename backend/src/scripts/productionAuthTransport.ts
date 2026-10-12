import { createHash } from 'node:crypto';
import { API_RATE_LIMIT_POLICIES, getApiRateLimitKey } from '../middleware/apiRateLimit.js';
import { getLoginRateLimitKeys } from '../modules/auth/loginRateLimiter.js';
import { verifyPassword } from '../services/passwordService.js';
import { AUTH_ACCOUNT, authRecord, authRequire, AuthExecutorError } from './productionAuthExecutorCore.js';
import { INTEGRATION_ORIGIN } from './productionManagedIntegrationCore.js';

export interface AuthTransportScope {
  origin: string; key: string; userId: string; username: string; newPassword: string;
  deadline: number; beforeRequest(): void;
}
export interface AuthTransport {
  fetch: typeof fetch; armRotation(): void; assertHealthy(): void;
  observations: { sent: number; blocked: number; writesAttempted: number; rotationAttempts: number;
    rotationOutcome: 'not-attempted' | 'unknown' | 'acknowledged' };
  counterKeys: { login: readonly string[]; api: readonly string[] };
}
const projections: Record<string, readonly string[]> = {
  users: ['id', 'username', 'nama', 'role', 'is_first_login', 'is_active', 'auth_version', 'password_hash'],
  students: ['id', 'is_active'], access_role_permissions: ['role_key', 'permission_key'],
};
const RATE_RPCS: Record<string, { keys: readonly string[]; cap: number }> = {
  is_login_rate_limited: { keys: ['p_rate_key', 'p_window_seconds', 'p_max_attempts'], cap: 6 },
  clear_login_rate_limit: { keys: ['p_rate_key'], cap: 4 },
  record_login_failure: { keys: ['p_rate_key', 'p_window_seconds'], cap: 2 },
  consume_api_rate_limit_atomic: { keys: ['p_rate_key', 'p_window_seconds', 'p_max_requests'], cap: 40 },
};

/** Only the constructor below may bind a live origin. Test scopes must use a reserved .invalid origin. */
export function createManagedAuthTransport(key: string, newPassword: string, deadline: number, beforeRequest: () => void,
  upstream: typeof fetch = fetch): AuthTransport {
  return createAuthTransport({ origin: INTEGRATION_ORIGIN, key, ...AUTH_ACCOUNT, newPassword, deadline, beforeRequest }, upstream);
}
export function createIsolatedAuthTransport(scope: AuthTransportScope, upstream: typeof fetch): AuthTransport {
  authRequire(new URL(scope.origin).hostname.endsWith('.invalid'), 'AUTH_TEST_ORIGIN_MUST_BE_RESERVED');
  return createAuthTransport(scope, upstream);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}
function allowRead(url: URL, scope: AuthTransportScope): boolean {
  const relation = url.pathname.slice('/rest/v1/'.length), columns = projections[relation];
  if (!columns) return false;
  const query = url.searchParams, select = query.get('select')?.split(',');
  if (!select?.length || select.some(column => !columns.includes(column))) return false;
  if ([...query.keys()].length !== new Set(query.keys()).size) return false;
  if ([...query.keys()].some(key => !['select', 'id', 'username', 'user_id', 'role_key', 'order'].includes(key))) return false;
  if (relation === 'users') {
    const id = query.get('id'), username = query.get('username');
    return !query.has('order') && !query.has('user_id') && !query.has('role_key')
      && ((id === `eq.${scope.userId}` || id === `in.(${scope.userId})`) && !username
        || username === `eq.${scope.username}` && !id);
  }
  if (relation === 'students') return exactKeys(Object.fromEntries(query), ['select', 'user_id']) && query.get('user_id') === `eq.${scope.userId}`;
  return !query.has('id') && !query.has('username') && !query.has('user_id')
    && (!query.has('role_key') || query.get('role_key') === 'eq.teacher')
    && (!query.has('order') || /^(?:role_key|permission_key)\.(?:asc|desc)(?:,(?:role_key|permission_key)\.(?:asc|desc))*$/.test(query.get('order') ?? ''));
}

function createAuthTransport(scope: AuthTransportScope, upstream: typeof fetch): AuthTransport {
  const observations: AuthTransport['observations'] = { sent: 0, blocked: 0, writesAttempted: 0,
    rotationAttempts: 0, rotationOutcome: 'not-attempted' };
  const rpcCounts = new Map<string, number>();
  const counterKeys = {
    login: getLoginRateLimitKeys('127.0.0.1', scope.username).map(key => createHash('sha256').update(key).digest('hex')),
    api: [getApiRateLimitKey('ip:127.0.0.1', API_RATE_LIMIT_POLICIES.ip),
      getApiRateLimitKey('ip:127.0.0.1', API_RATE_LIMIT_POLICIES.loginIp),
      ...[API_RATE_LIMIT_POLICIES.account, API_RATE_LIMIT_POLICIES.write, API_RATE_LIMIT_POLICIES.credentials]
        .map(policy => getApiRateLimitKey('account:' + scope.userId, policy))],
  };
  let armed = false, halted = false;
  let haltedStage = 'AUTH_TRANSPORT_HALTED_INSPECT_BEFORE_RETRY';
  function healthy(): void { authRequire(!halted, haltedStage); }
  const perform: typeof fetch = async (input, init) => {
    let passwordRpc = false;
    try {
      healthy(); scope.beforeRequest();
      authRequire(Date.now() < scope.deadline && observations.sent < 150, 'AUTH_REQUEST_DEADLINE_OR_BUDGET');
      const request = new Request(input, init), url = new URL(request.url);
      authRequire(url.origin === scope.origin && !url.username && !url.password && !url.hash
        && request.headers.get('apikey') === scope.key
        && (!request.headers.has('authorization') || request.headers.get('authorization') === `Bearer ${scope.key}`)
        && ['accept-profile', 'content-profile'].every(header => !request.headers.has(header) || request.headers.get(header) === 'public'),
      'AUTH_TARGET_KEY_OR_SCHEMA_BARRIER');
      if (request.method === 'GET') {
        authRequire(request.body === null && allowRead(url, scope), 'AUTH_READ_SCOPE_BARRIER');
      } else {
        authRequire(request.method === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')
          && !url.search && request.headers.get('content-type')?.startsWith('application/json'), 'AUTH_MUTATION_BARRIER');
        const raw = await request.clone().text();
        authRequire(raw.length <= 2048, 'AUTH_RPC_PAYLOAD_TOO_LARGE');
        const args = authRecord(JSON.parse(raw) as unknown), rpc = url.pathname.slice('/rest/v1/rpc/'.length);
        const count = rpcCounts.get(rpc) ?? 0;
        if (rpc === 'change_password_atomic') {
          authRequire(armed && observations.rotationAttempts === 0 && exactKeys(args,
            ['p_user_id', 'p_updated_by', 'p_password_hash', 'p_expected_auth_version', 'p_change_reason'])
            && args.p_user_id === scope.userId && args.p_updated_by === scope.userId && args.p_expected_auth_version === 1
            && args.p_change_reason === 'Pengguna mengganti password akun' && typeof args.p_password_hash === 'string'
            && /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(args.p_password_hash)
            && (await verifyPassword(scope.newPassword, args.p_password_hash)).valid,
          'AUTH_ONE_REVIEWED_PASSWORD_ROTATION_ONLY');
          armed = false; passwordRpc = true;
        } else {
          const contract = RATE_RPCS[rpc];
          authRequire(Object.hasOwn(RATE_RPCS, rpc) && count < contract.cap && exactKeys(args, contract.keys)
            && typeof args.p_rate_key === 'string' && /^[a-f0-9]{64}$/.test(args.p_rate_key), 'AUTH_RATE_RPC_SCOPE_BARRIER');
          authRequire((rpc === 'consume_api_rate_limit_atomic' ? counterKeys.api : counterKeys.login).includes(args.p_rate_key), 'AUTH_RATE_PRINCIPAL_SCOPE');
          if (rpc === 'consume_api_rate_limit_atomic') {
            authRequire([[60, 180], [60, 1200], [300, 10], [60, 60]].some(([window, limit]) =>
              args.p_window_seconds === window && args.p_max_requests === limit), 'AUTH_API_QUOTA_CONTRACT');
          } else if (rpc !== 'clear_login_rate_limit') {
            authRequire(args.p_window_seconds === 300 && (rpc !== 'is_login_rate_limited' || args.p_max_attempts === 10), 'AUTH_LOGIN_QUOTA_CONTRACT');
          }
        }
        rpcCounts.set(rpc, count + 1);
      }
      scope.beforeRequest(); authRequire(Date.now() < scope.deadline, 'AUTH_REQUEST_DEADLINE_OR_BUDGET');
      observations.sent++;
      if (request.method === 'POST' && !url.pathname.endsWith('/is_login_rate_limited')) observations.writesAttempted++;
      if (passwordRpc) { observations.rotationAttempts++; observations.rotationOutcome = 'unknown'; }
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(Math.min(8000, Math.max(1, scope.deadline - Date.now())))]);
      const response = await abortable(upstream(request, { redirect: 'error', signal }), signal);
      authRequire(!response.redirected && response.status < 300 && response.status >= 200
        && (!response.url || new URL(response.url).origin === scope.origin), 'AUTH_UPSTREAM_FAILED_OR_REDIRECTED');
      // Drain under the same deadline; never pass an unbounded body to the SDK.
      const reader = response.body?.getReader(), chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) try {
        while (true) {
          signal.throwIfAborted(); const chunk = await abortable(reader.read(), signal);
          if (chunk.done) break;
          size += chunk.value.length; authRequire(size <= 256 * 1024, 'AUTH_UPSTREAM_BODY_TOO_LARGE'); chunks.push(chunk.value);
        }
      } finally { void reader.cancel().catch(() => {}); }
      const body = Buffer.concat(chunks);
      if (passwordRpc) {
        const data = authRecord(JSON.parse(body.toString('utf8')) as unknown);
        authRequire(data.id === scope.userId && data.is_first_login === false && data.is_active === true && data.auth_version === 2,
          'AUTH_ROTATION_ACK_INVALID_INSPECT_REQUIRED');
        observations.rotationOutcome = 'acknowledged';
      }
      return new Response(response.status === 204 ? null : body, { status: response.status, headers: response.headers });
    } catch (error: unknown) {
      halted = true; observations.blocked++;
      const failure = error instanceof AuthExecutorError ? error : new AuthExecutorError('AUTH_REQUEST_FAILED_INSPECT_BEFORE_RETRY');
      haltedStage = failure.stage; throw failure;
    }
  };
  // The real login limiter reads two namespaces concurrently. Serialize those
  // requests while retaining the one-shot latch and the fail-closed state.
  let tail: Promise<void> = Promise.resolve(), pending = 0;
  const guarded: typeof fetch = (input, init) => {
    if (pending >= 8) { halted = true; haltedStage = 'AUTH_PENDING_REQUEST_BUDGET'; return Promise.reject(new AuthExecutorError(haltedStage)); }
    pending++;
    const next = tail.then(() => perform(input, init));
    tail = next.then(() => {}, () => {});
    return next.finally(() => { pending--; });
  };
  return { fetch: guarded, observations, counterKeys, assertHealthy: healthy,
    armRotation() { healthy(); authRequire(!armed && observations.rotationAttempts === 0, 'AUTH_ROTATION_ALREADY_ARMED_OR_ATTEMPTED'); armed = true; } };
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const abort = new Promise<never>((_, reject) => {
    onAbort = () => reject(new AuthExecutorError('AUTH_REQUEST_DEADLINE_ABORTED'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([promise, abort]); }
  finally { signal.removeEventListener('abort', onAbort); }
}
