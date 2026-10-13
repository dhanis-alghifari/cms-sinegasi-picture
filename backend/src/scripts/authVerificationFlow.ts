import type { FastifyInstance } from 'fastify';
import { authRecord, authRequire } from './productionAuthExecutorCore.js';
import type { AuthFlowAccount } from './productionAuthManagedFlow.js';
import type { AuthVerificationTransport } from './productionAuthTransport.js';

export const AUTH_VERIFICATION_CHECKS = ['ROTATED_CREDENTIAL_PREFLIGHT', 'LIVENESS_AND_SECURITY_HEADERS',
  'ANONYMOUS_PROTECTED_READ_DENIED', 'CURRENT_PASSWORD_LOGIN_VERSION_TWO', 'VERSION_TWO_ME_ALLOWED',
  'BUSINESS_READ_ALLOWED_AFTER_ROTATION', 'PREVIOUS_PASSWORD_DENIED',
  'LOGOUT_ACKNOWLEDGED_WITHOUT_SERVER_REVOCATION', 'ACCOUNT_UNCHANGED_ZERO_PASSWORD_MUTATIONS'] as const;

export interface AuthVerificationDependencies {
  account: AuthFlowAccount;
  currentPassword: string;
  previousPassword: string;
  transport: AuthVerificationTransport;
  preflight(): Promise<void>;
  consumeAttempt(): Promise<void>;
  verifyPostcondition(): Promise<void>;
}

/** In-memory rehearsal latch only; NOT a durable production execution authorization. */
export function createIsolatedVerificationAttempt(): () => Promise<void> {
  let consumed = false;
  return async () => {
    authRequire(!consumed, 'AUTH_VERIFICATION_ATTEMPT_ALREADY_CONSUMED');
    consumed = true;
  };
}

/** Never invokes password-change/reset. Even login and business reads can write rate counters. */
export async function runAuthVerificationFlow(app: FastifyInstance, d: AuthVerificationDependencies): Promise<readonly string[]> {
  authRequire(d.account.role === 'teacher' && d.currentPassword.length > 0 && d.previousPassword.length > 0
    && d.currentPassword !== d.previousPassword, 'AUTH_VERIFICATION_CREDENTIALS_INVALID');
  await d.preflight();
  await d.consumeAttempt(); // Must succeed BEFORE even anonymous request counters.
  const checks: string[] = [];
  function check(stage: typeof AUTH_VERIFICATION_CHECKS[number]): void {
    d.transport.assertHealthy();
    authRequire(d.transport.observations.rotationAttempts === 0
      && d.transport.observations.rotationOutcome === 'not-attempted', 'AUTH_VERIFICATION_PASSWORD_MUTATION_FORBIDDEN');
    checks.push(stage);
  }
  function noSecrets(body: string): void {
    authRequire(!body.includes(d.currentPassword) && !body.includes(d.previousPassword)
      && !body.includes('password_hash') && !body.includes('scrypt$'), 'AUTH_VERIFICATION_SECRET_EXPOSED');
  }
  function account(value: unknown): void {
    const user = authRecord(value);
    authRequire(user.id === d.account.userId && user.username === d.account.username && user.nama === d.account.nama
      && user.role === 'teacher' && user.is_active === true && user.is_first_login === false && user.auth_version === 2
      && Array.isArray(user.capabilities) && user.capabilities.includes('access_control.manage'), 'AUTH_VERIFICATION_ACCOUNT_STATE');
  }
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const login = (password: string) => app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: d.account.username, password } });
  const me = (token: string) => app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
  check('ROTATED_CREDENTIAL_PREFLIGHT');
  const health = await app.inject({ method: 'GET', url: '/api/health' }); noSecrets(health.body);
  authRequire(health.statusCode === 200 && health.headers['x-content-type-options'] === 'nosniff'
    && health.headers['cache-control'] === 'no-store', 'AUTH_VERIFICATION_HEALTH'); check('LIVENESS_AND_SECURITY_HEADERS');
  const anonymous = await app.inject({ method: 'GET', url: '/api/access-control/matrix' }); noSecrets(anonymous.body);
  authRequire(anonymous.statusCode === 401, 'AUTH_VERIFICATION_ANONYMOUS_READ'); check('ANONYMOUS_PROTECTED_READ_DENIED');
  const current = await login(d.currentPassword); d.transport.assertHealthy(); noSecrets(current.body);
  const session = authRecord(current.json());
  authRequire(current.statusCode === 200 && session.success === true && typeof session.token === 'string', 'AUTH_VERIFICATION_CURRENT_LOGIN');
  account(session.user);
  const claims = app.jwt.verify<Record<string, unknown>>(session.token);
  authRequire(claims.userId === d.account.userId && claims.username === d.account.username && claims.role === 'teacher'
    && claims.isFirstLogin === false && claims.authVersion === 2, 'AUTH_VERIFICATION_TOKEN_CLAIMS');
  check('CURRENT_PASSWORD_LOGIN_VERSION_TWO');
  const own = await me(session.token); noSecrets(own.body);
  authRequire(own.statusCode === 200, 'AUTH_VERIFICATION_ME'); account(own.json()); check('VERSION_TWO_ME_ALLOWED');
  const business = await app.inject({ method: 'GET', url: '/api/access-control/matrix', headers: bearer(session.token) }); noSecrets(business.body);
  authRequire(business.statusCode === 200 && authRecord(business.json()).success === true, 'AUTH_VERIFICATION_BUSINESS_READ');
  check('BUSINESS_READ_ALLOWED_AFTER_ROTATION');
  const previous = await login(d.previousPassword); noSecrets(previous.body);
  const rejected = authRecord(previous.json());
  authRequire(previous.statusCode === 401 && rejected.success === false && rejected.error === 'Invalid credentials'
    && !('token' in rejected), 'AUTH_VERIFICATION_PREVIOUS_PASSWORD_VALID');
  check('PREVIOUS_PASSWORD_DENIED');
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(session.token) }); noSecrets(logout.body);
  authRequire(logout.statusCode === 200 && authRecord(logout.json()).success === true, 'AUTH_VERIFICATION_LOGOUT');
  const afterLogout = await me(session.token); noSecrets(afterLogout.body);
  authRequire(afterLogout.statusCode === 200, 'AUTH_VERIFICATION_LOGOUT_CONTRACT_CHANGED'); account(afterLogout.json());
  check('LOGOUT_ACKNOWLEDGED_WITHOUT_SERVER_REVOCATION');
  await d.verifyPostcondition(); check('ACCOUNT_UNCHANGED_ZERO_PASSWORD_MUTATIONS');
  authRequire(JSON.stringify(checks) === JSON.stringify(AUTH_VERIFICATION_CHECKS), 'AUTH_VERIFICATION_CHECKS_INCOMPLETE');
  return checks;
}
