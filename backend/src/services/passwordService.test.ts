import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertPasswordPolicy,
  createSecureTemporaryPassword,
  createTemporaryPassword,
  hashPassword,
  verifyPassword,
} from './passwordService.js';

test('hashPassword creates a non-plaintext scrypt hash', async () => {
  const password = 'Siswa123!';
  const hash = await hashPassword(password);

  assert.match(hash, /^scrypt\$/);
  assert.notEqual(hash, password);
  assert.deepEqual(await verifyPassword(password, hash), { valid: true, needsRehash: false });
  assert.deepEqual(await verifyPassword('PasswordSalah!', hash), { valid: false, needsRehash: false });
});

test('legacy plaintext credentials are accepted only for one-time rehash', async () => {
  assert.deepEqual(await verifyPassword('legacy123', 'legacy123'), { valid: true, needsRehash: true });
  assert.deepEqual(await verifyPassword('wrong123', 'legacy123'), { valid: false, needsRehash: true });
});

test('malformed password hashes fail closed', async () => {
  assert.deepEqual(await verifyPassword('Password123', 'scrypt$broken'), { valid: false, needsRehash: false });
});

test('password policy rejects weak credentials', () => {
  assert.throws(() => assertPasswordPolicy('short'), /8-128/);
  assert.throws(() => assertPasswordPolicy('abcdefgh'), /huruf dan satu angka/);
  assert.doesNotThrow(() => assertPasswordPolicy('strong-pass-123'));
});

test('createTemporaryPassword and createSecureTemporaryPassword always satisfy policy', () => {
  const temp = createTemporaryPassword();
  assert.doesNotThrow(() => assertPasswordPolicy(temp));

  const secureTemp = createSecureTemporaryPassword();
  assert.doesNotThrow(() => assertPasswordPolicy(secureTemp));
});

test('new-account temporary passwords are unique and random in every environment', () => {
  const passwords = Array.from({ length: 100 }, () => createTemporaryPassword());
  assert.equal(new Set(passwords).size, passwords.length);
  for (const password of passwords) {
    assert.match(password, /^Siswa-\d{6}-[A-Za-z0-9_-]{16}$/);
    assert.doesNotThrow(() => assertPasswordPolicy(password));
  }
});

test('temporary password prefixes cannot violate password length or character policy', () => {
  for (const prefix of ['', '123', ' X\nY!* ', 'A'.repeat(300)]) {
    assert.doesNotThrow(() => assertPasswordPolicy(createTemporaryPassword(prefix)));
    assert.doesNotThrow(() => assertPasswordPolicy(createSecureTemporaryPassword(prefix)));
  }
});
