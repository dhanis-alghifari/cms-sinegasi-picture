import type { FastifyInstance } from 'fastify';
import { AuthAcceptanceError, AUTH_FIXTURE_USER_ID, type AuthAcceptanceFixture } from './authAcceptanceFixture.js';

export const AUTH_ACCEPTANCE_CHECKS = [
  'LIVENESS_AND_SECURITY_HEADERS',
  'ANONYMOUS_PROTECTED_READ_DENIED',
  'WRONG_PASSWORD_DENIED',
  'TEMPORARY_PASSWORD_LOGIN_FIRST_LOGIN_REQUIRED',
  'FIRST_LOGIN_ME_ALLOWED',
  'FIRST_LOGIN_BUSINESS_READ_BLOCKED',
  'INVALID_PASSWORD_CHANGES_LEAVE_ACCOUNT_UNCHANGED',
  'ATOMIC_VERSION_CONFLICT_FAILS_CLOSED',
  'PASSWORD_ROTATION_UPDATES_SESSION',
  'PREVIOUS_TOKEN_REVOKED',
  'PREVIOUS_PASSWORD_DENIED',
  'NEW_PASSWORD_LOGIN_SUCCEEDS',
  'BUSINESS_READ_ALLOWED_AFTER_ROTATION',
  'IDENTITY_OUTAGE_FAILS_CLOSED',
  'LOGOUT_ACKNOWLEDGED_WITHOUT_SERVER_REVOCATION',
  'RATE_STORE_OUTAGE_FAILS_CLOSED',
] as const;

function requireCheck(condition: boolean, stage: string): void {
  if (!condition) throw new AuthAcceptanceError(stage);
}

function object(value: unknown): Record<string, unknown> {
  requireCheck(Boolean(value) && typeof value === 'object' && !Array.isArray(value), 'AUTH_RESPONSE_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}

function account(value: unknown, firstLogin: boolean, version: number): void {
  const user = object(value);
  requireCheck(user.id === AUTH_FIXTURE_USER_ID && user.username === 'fixture_guru'
    && user.nama === 'Guru Terisolasi' && user.role === 'teacher' && user.is_active === true
    && user.is_first_login === firstLogin && user.auth_version === version, 'AUTH_ACCOUNT_STATE_MISMATCH');
  requireCheck(Array.isArray(user.capabilities) && user.capabilities.includes('access_control.manage'), 'AUTH_CAPABILITIES_MISSING');
}

function token(value: unknown, app: FastifyInstance, firstLogin: boolean, version: number): string {
  requireCheck(typeof value === 'string' && value.length > 0, 'AUTH_TOKEN_REQUIRED');
  const signed = value as string;
  const claims = app.jwt.verify<Record<string, unknown>>(signed);
  requireCheck(claims.userId === AUTH_FIXTURE_USER_ID && claims.role === 'teacher'
    && claims.isFirstLogin === firstLogin && claims.authVersion === version, 'AUTH_SIGNED_CLAIMS_MISMATCH');
  return signed;
}

/** Uses real HTTP routes, middleware, scrypt and SDK adapters, but only an in-memory REST fixture. */
export async function rehearseAuthFlow(
  app: FastifyInstance,
  fixture: AuthAcceptanceFixture,
  clearAuthStateCache: (userId?: string) => void,
): Promise<readonly string[]> {
  const checks: string[] = [];
  const checked = (stage: typeof AUTH_ACCEPTANCE_CHECKS[number]) => { checks.push(stage); };
  const bearer = (signed: string) => ({ authorization: `Bearer ${signed}` });
  const login = (password: string) => app.inject({ method: 'POST', url: '/api/auth/login',
    payload: { username: 'fixture_guru', password } });
  const businessRead = (signed?: string) => app.inject({ method: 'GET', url: '/api/access-control/matrix',
    headers: signed ? bearer(signed) : {} });
  const me = (signed: string) => app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(signed) });
  const passwordBody = (overrides: Record<string, unknown> = {}) => ({ current_password: fixture.temporaryPassword,
    new_password: fixture.newPassword, confirm_password: fixture.newPassword, ...overrides });
  const change = (signed: string, payload: Record<string, unknown>) => app.inject({ method: 'POST',
    url: '/api/auth/change-password', headers: bearer(signed), payload });
  const noSecrets = (response: { body: string }) => requireCheck(
    !response.body.includes(fixture.temporaryPassword) && !response.body.includes(fixture.newPassword)
      && !response.body.includes('password_hash') && !response.body.includes('scrypt$'), 'AUTH_SECRET_EXPOSED');

  const health = await app.inject({ method: 'GET', url: '/api/health' });
  requireCheck(health.statusCode === 200 && health.headers['x-content-type-options'] === 'nosniff'
    && health.headers['cache-control'] === 'no-store', 'AUTH_HEALTH_FAILED');
  checked('LIVENESS_AND_SECURITY_HEADERS');
  requireCheck((await businessRead()).statusCode === 401, 'AUTH_ANONYMOUS_READ_ALLOWED');
  checked('ANONYMOUS_PROTECTED_READ_DENIED');
  const wrong = await login('WrongFixturePassword123');
  requireCheck(wrong.statusCode === 401 && !('token' in object(wrong.json())), 'AUTH_WRONG_PASSWORD_ACCEPTED');
  noSecrets(wrong); checked('WRONG_PASSWORD_DENIED');

  const first = await login(fixture.temporaryPassword);
  requireCheck(first.statusCode === 200 && object(first.json()).success === true
    && String(first.headers['cache-control']).includes('no-store'), 'AUTH_FIRST_LOGIN_FAILED');
  account(object(first.json()).user, true, 1); noSecrets(first);
  const oldToken = token(object(first.json()).token, app, true, 1);
  checked('TEMPORARY_PASSWORD_LOGIN_FIRST_LOGIN_REQUIRED');
  const firstMe = await me(oldToken);
  requireCheck(firstMe.statusCode === 200, 'AUTH_FIRST_LOGIN_ME_FAILED'); account(firstMe.json(), true, 1); noSecrets(firstMe);
  checked('FIRST_LOGIN_ME_ALLOWED');
  const forbidden = await businessRead(oldToken);
  requireCheck(forbidden.statusCode === 403 && object(forbidden.json()).error === 'FORCE_PASSWORD_CHANGE', 'AUTH_FIRST_LOGIN_GUARD_FAILED');
  checked('FIRST_LOGIN_BUSINESS_READ_BLOCKED');

  const invalidChanges = [
    { body: {}, code: undefined },
    { body: passwordBody({ new_password: 'short1', confirm_password: 'short1' }), code: 'PASSWORD_POLICY' },
    { body: passwordBody({ new_password: 'NoDigitsHere', confirm_password: 'NoDigitsHere' }), code: 'PASSWORD_POLICY' },
    { body: passwordBody({ confirm_password: 'MismatchFixture123' }), code: 'PASSWORD_MISMATCH' },
    { body: passwordBody({ new_password: fixture.temporaryPassword, confirm_password: fixture.temporaryPassword }), code: 'PASSWORD_REUSE' },
    { body: passwordBody({ current_password: 'WrongFixturePassword123' }), code: 'CURRENT_PASSWORD_INVALID' },
  ];
  for (const invalid of invalidChanges) {
    const response = await change(oldToken, invalid.body);
    requireCheck(response.statusCode === 400 && (!invalid.code || object(response.json()).error === invalid.code), 'AUTH_INVALID_CHANGE_ACCEPTED');
    requireCheck(!('token' in object(response.json())), 'AUTH_INVALID_CHANGE_ISSUED_TOKEN'); noSecrets(response);
    const state = fixture.snapshot();
    requireCheck(state.version === 1 && state.firstLogin && state.passwordChanges === 0 && state.passwordRpcCalls === 0,
      'AUTH_REJECTED_CHANGE_MUTATED_ACCOUNT');
  }
  checked('INVALID_PASSWORD_CHANGES_LEAVE_ACCOUNT_UNCHANGED');
  fixture.failNextPasswordChange();
  const conflict = await change(oldToken, passwordBody());
  requireCheck(conflict.statusCode === 401 && object(conflict.json()).error === 'SESSION_REVOKED'
    && !('token' in object(conflict.json())) && fixture.snapshot().passwordChanges === 0
    && fixture.snapshot().version === 1 && fixture.snapshot().firstLogin, 'AUTH_CONFLICT_NOT_REJECTED');
  checked('ATOMIC_VERSION_CONFLICT_FAILS_CLOSED');

  const changed = await change(oldToken, passwordBody());
  requireCheck(changed.statusCode === 200 && object(changed.json()).success === true, 'AUTH_ROTATION_FAILED');
  account(object(changed.json()).user, false, 2); noSecrets(changed);
  const updatedToken = token(object(changed.json()).token, app, false, 2);
  requireCheck(updatedToken !== oldToken && fixture.snapshot().passwordChanges === 1
    && fixture.snapshot().version === 2 && !fixture.snapshot().firstLogin, 'AUTH_ROTATION_STATE_FAILED');
  checked('PASSWORD_ROTATION_UPDATES_SESSION');
  const revoked = await me(oldToken);
  requireCheck(revoked.statusCode === 401 && object(revoked.json()).error === 'SESSION_REVOKED', 'AUTH_PREVIOUS_TOKEN_STILL_VALID');
  requireCheck((await businessRead(oldToken)).statusCode === 401, 'AUTH_PREVIOUS_TOKEN_BUSINESS_READ_ALLOWED');
  const updatedMe = await me(updatedToken);
  requireCheck(updatedMe.statusCode === 200, 'AUTH_ROTATED_TOKEN_FAILED'); account(updatedMe.json(), false, 2);
  checked('PREVIOUS_TOKEN_REVOKED');
  requireCheck((await login(fixture.temporaryPassword)).statusCode === 401, 'AUTH_PREVIOUS_PASSWORD_STILL_VALID');
  checked('PREVIOUS_PASSWORD_DENIED');
  const second = await login(fixture.newPassword);
  requireCheck(second.statusCode === 200, 'AUTH_NEW_PASSWORD_LOGIN_FAILED'); account(object(second.json()).user, false, 2); noSecrets(second);
  const newToken = token(object(second.json()).token, app, false, 2);
  checked('NEW_PASSWORD_LOGIN_SUCCEEDS');
  const allowed = await businessRead(newToken);
  requireCheck(allowed.statusCode === 200 && object(allowed.json()).success === true, 'AUTH_AFTER_ROTATION_BUSINESS_READ_FAILED');
  checked('BUSINESS_READ_ALLOWED_AFTER_ROTATION');

  fixture.setIdentityUnavailable(true); clearAuthStateCache(AUTH_FIXTURE_USER_ID);
  const unavailable = await me(newToken);
  requireCheck(unavailable.statusCode === 503 && object(unavailable.json()).error === 'AUTHENTICATION_UNAVAILABLE', 'AUTH_IDENTITY_OUTAGE_NOT_CLOSED');
  fixture.setIdentityUnavailable(false); clearAuthStateCache(AUTH_FIXTURE_USER_ID);
  checked('IDENTITY_OUTAGE_FAILS_CLOSED');
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(newToken) });
  requireCheck(logout.statusCode === 200 && object(logout.json()).success === true, `AUTH_LOGOUT_ACK_FAILED_HTTP_${logout.statusCode}`);
  // Characterize the current contract honestly; logout is NOT server-side revocation.
  requireCheck((await me(newToken)).statusCode === 200, 'AUTH_LOGOUT_CONTRACT_CHANGED_REVIEW_REQUIRED');
  checked('LOGOUT_ACKNOWLEDGED_WITHOUT_SERVER_REVOCATION');
  // Last: the real shared-store wrapper intentionally keeps a 5-second outage circuit open.
  fixture.setLimiterUnavailable(true);
  const limited = await login(fixture.newPassword);
  requireCheck(limited.statusCode === 503 && !('token' in object(limited.json())), 'AUTH_RATE_OUTAGE_ISSUED_TOKEN');
  fixture.setLimiterUnavailable(false); checked('RATE_STORE_OUTAGE_FAILS_CLOSED');
  requireCheck(fixture.snapshot().blocked === 0, `AUTH_UNEXPECTED_ADAPTER_REQUEST_${fixture.snapshot().blockedStages.join('_')}`);
  return checks;
}
