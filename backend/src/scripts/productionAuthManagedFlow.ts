import type { FastifyInstance } from 'fastify';
import { authRecord, authRequire, MANAGED_AUTH_CHECKS } from './productionAuthExecutorCore.js';
import type { AuthTransport } from './productionAuthTransport.js';

export interface AuthFlowAccount { userId: string; username: string; nama: string; role: 'teacher' }
export interface AuthFlowDependencies {
  account: AuthFlowAccount; temporaryPassword: string; newPassword: string; transport: AuthTransport;
  persistCustody(): Promise<void>;
  beforeRotation(): Promise<void>;
  verifyPostcondition(): Promise<void>;
}

/** Positive acceptance path only. Fault injection/invalid-password permutations are isolated-only. */
export async function runManagedAuthFlow(app: FastifyInstance, d: AuthFlowDependencies): Promise<readonly string[]> {
  await d.persistCustody(); // Durable one-shot latch/password, BEFORE even rate-counter requests.
  const checks: string[] = [];
  function check(stage: typeof MANAGED_AUTH_CHECKS[number]): void { d.transport.assertHealthy(); checks.push(stage); }
  function account(value: unknown, first: boolean, version: number): void {
    const user = authRecord(value);
    authRequire(user.id === d.account.userId && user.username === d.account.username && user.nama === d.account.nama
      && user.role === 'teacher' && user.is_active === true && user.is_first_login === first && user.auth_version === version
      && Array.isArray(user.capabilities) && user.capabilities.includes('access_control.manage'), 'AUTH_FLOW_ACCOUNT_STATE');
  }
  function token(value: unknown, first: boolean, version: number): string {
    authRequire(typeof value === 'string' && value.length > 0, 'AUTH_FLOW_TOKEN_REQUIRED');
    const claims = app.jwt.verify<Record<string, unknown>>(value);
    authRequire(claims.userId === d.account.userId && claims.role === 'teacher' && claims.isFirstLogin === first
      && claims.authVersion === version, 'AUTH_FLOW_TOKEN_CLAIMS'); return value;
  }
  function noSecrets(body: string): void {
    authRequire(!body.includes(d.temporaryPassword) && !body.includes(d.newPassword)
      && !body.includes('password_hash') && !body.includes('scrypt$'), 'AUTH_FLOW_SECRET_EXPOSED');
  }
  const bearer = (signed: string) => ({ authorization: `Bearer ${signed}` });
  const login = (password: string) => app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: d.account.username, password } });
  const me = (signed: string) => app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(signed) });
  const matrix = (signed?: string) => app.inject({ method: 'GET', url: '/api/access-control/matrix', headers: signed ? bearer(signed) : {} });
  const health = await app.inject({ method: 'GET', url: '/api/health' });
  authRequire(health.statusCode === 200 && health.headers['x-content-type-options'] === 'nosniff'
    && health.headers['cache-control'] === 'no-store', 'AUTH_FLOW_HEALTH'); check('LIVENESS_AND_SECURITY_HEADERS');
  authRequire((await matrix()).statusCode === 401, 'AUTH_FLOW_ANONYMOUS_READ'); check('ANONYMOUS_PROTECTED_READ_DENIED');
  const first = await login(d.temporaryPassword); d.transport.assertHealthy(); noSecrets(first.body);
  authRequire(first.statusCode === 200 && authRecord(first.json()).success === true, 'AUTH_FLOW_INITIAL_LOGIN');
  account(authRecord(first.json()).user, true, 1); const previousToken = token(authRecord(first.json()).token, true, 1);
  check('TEMPORARY_PASSWORD_LOGIN_FIRST_LOGIN_REQUIRED');
  const firstMe = await me(previousToken); noSecrets(firstMe.body);
  authRequire(firstMe.statusCode === 200, 'AUTH_FLOW_INITIAL_ME'); account(firstMe.json(), true, 1); check('FIRST_LOGIN_ME_ALLOWED');
  const forbidden = await matrix(previousToken);
  authRequire(forbidden.statusCode === 403 && authRecord(forbidden.json()).error === 'FORCE_PASSWORD_CHANGE', 'AUTH_FLOW_FIRST_LOGIN_GUARD');
  check('FIRST_LOGIN_BUSINESS_READ_BLOCKED');
  await d.beforeRotation(); d.transport.armRotation();
  const changed = await app.inject({ method: 'POST', url: '/api/auth/change-password', headers: bearer(previousToken),
    payload: { current_password: d.temporaryPassword, new_password: d.newPassword, confirm_password: d.newPassword } });
  d.transport.assertHealthy(); noSecrets(changed.body);
  authRequire(changed.statusCode === 200 && authRecord(changed.json()).success === true, 'AUTH_FLOW_ROTATION_FAILED_INSPECT_REQUIRED');
  account(authRecord(changed.json()).user, false, 2); const rotatedToken = token(authRecord(changed.json()).token, false, 2);
  authRequire(d.transport.observations.rotationAttempts === 1 && d.transport.observations.rotationOutcome === 'acknowledged'
    && rotatedToken !== previousToken, 'AUTH_FLOW_SINGLE_ROTATION_NOT_PROVEN'); check('PASSWORD_ROTATION_UPDATES_SESSION');
  const stale = await me(previousToken);
  authRequire(stale.statusCode === 401 && authRecord(stale.json()).error === 'SESSION_REVOKED'
    && (await matrix(previousToken)).statusCode === 401, 'AUTH_FLOW_PREVIOUS_TOKEN_VALID');
  const rotatedMe = await me(rotatedToken); authRequire(rotatedMe.statusCode === 200, 'AUTH_FLOW_ROTATED_ME'); account(rotatedMe.json(), false, 2);
  check('PREVIOUS_TOKEN_REVOKED');
  const oldPassword = await login(d.temporaryPassword); noSecrets(oldPassword.body);
  authRequire(oldPassword.statusCode === 401 && !('token' in authRecord(oldPassword.json())), 'AUTH_FLOW_PREVIOUS_PASSWORD_VALID');
  check('PREVIOUS_PASSWORD_DENIED');
  const second = await login(d.newPassword); noSecrets(second.body); authRequire(second.statusCode === 200, 'AUTH_FLOW_NEW_LOGIN');
  account(authRecord(second.json()).user, false, 2); const signed = token(authRecord(second.json()).token, false, 2); check('NEW_PASSWORD_LOGIN_SUCCEEDS');
  const business = await matrix(signed); noSecrets(business.body);
  authRequire(business.statusCode === 200 && authRecord(business.json()).success === true, 'AUTH_FLOW_BUSINESS_READ');
  check('BUSINESS_READ_ALLOWED_AFTER_ROTATION');
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(signed) });
  authRequire(logout.statusCode === 200 && authRecord(logout.json()).success === true && (await me(signed)).statusCode === 200,
    'AUTH_FLOW_LOGOUT_CONTRACT_CHANGED'); check('LOGOUT_ACKNOWLEDGED_WITHOUT_SERVER_REVOCATION');
  await d.verifyPostcondition();
  authRequire(JSON.stringify(checks) === JSON.stringify(MANAGED_AUTH_CHECKS), 'AUTH_FLOW_CHECKS_INCOMPLETE');
  return checks;
}
