import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword } from '../../services/passwordService.js';
import { AuthService, AuthServiceError } from './auth.service.js';
import type { AuthRepository } from './auth.repository.js';

function createRepository(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    isConfigured: () => true,
    findUserForLogin: async () => ({ data: null, error: null }),
    findUserById: async () => ({ data: null, error: null }),
    findLinkedStudent: async () => ({ data: null, error: null }),
    changePasswordAtomic: async () => ({ data: null, error: null }),
    ...overrides,
  };
}

test('login returns canonical payload for a valid database user', async () => {
  const passwordHash = await hashPassword('Password123');
  const service = new AuthService(createRepository({
    findUserForLogin: async () => ({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        username: 'admin',
        password_hash: passwordHash,
        nama: 'Admin',
        role: 'teacher',
        is_first_login: false,
        is_active: true,
        auth_version: 3,
      },
      error: null,
    }),
    findLinkedStudent: async () => ({ data: null, error: null }),
  }), false);

  const result = await service.login('admin', 'Password123');
  assert.equal(result.payload.userId, '11111111-1111-4111-8111-111111111111');
  assert.equal(result.payload.authVersion, 3);
  assert.equal(result.user.nama, 'Admin');
});

test('login rejects invalid credentials without exposing database details', async () => {
  const service = new AuthService(createRepository({
    findUserForLogin: async () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } }),
  }), false);

  await assert.rejects(
    service.login('admin', 'wrong'),
    (error: unknown) => error instanceof AuthServiceError
      && error.statusCode === 401
      && error.errorCode === 'INVALID_CREDENTIALS'
      && error.message === 'Username atau password salah.',
  );
});

test('public authentication does not issue unrevokable tokens for an incomplete security schema', async () => {
  const passwordHash = await hashPassword('Password123');
  for (const authVersion of [null, undefined, 0, NaN]) {
    const service = new AuthService(createRepository({
      findUserForLogin: async () => ({ data: {
        id: '11111111-1111-4111-8111-111111111111', username: 'admin', nama: 'Admin',
        password_hash: passwordHash, role: 'teacher', is_first_login: false, is_active: true,
        auth_version: authVersion,
      }, error: null }),
    }), false, true);
    await assert.rejects(service.login('admin', 'Password123'),
      (error: unknown) => error instanceof AuthServiceError && error.errorCode === 'AUTHENTICATION_UNAVAILABLE');
  }
});

test('a linked-student lookup error cannot silently issue a login token', async () => {
  const passwordHash = await hashPassword('Password123');
  const service = new AuthService(createRepository({
    findUserForLogin: async () => ({ data: {
      id: '11111111-1111-4111-8111-111111111111', username: 'member', nama: 'Siswa',
      password_hash: passwordHash, role: 'member', is_first_login: false, is_active: true, auth_version: 1,
    }, error: null }),
    findLinkedStudent: async () => ({ data: null, error: { code: '57014', message: 'Internal provider detail' } }),
  }), false, true);
  await assert.rejects(service.login('member', 'Password123'),
    (error: unknown) => error instanceof AuthServiceError && error.statusCode === 503
      && !error.message.includes('Internal provider detail'));
});
