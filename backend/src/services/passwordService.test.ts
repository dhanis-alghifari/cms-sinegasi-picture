import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './passwordService.js';

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

test('password policy rejects weak credentials', () => {
  assert.throws(() => assertPasswordPolicy('short'), /8-128/);
  assert.throws(() => assertPasswordPolicy('abcdefgh'), /huruf dan satu angka/);
  assert.doesNotThrow(() => assertPasswordPolicy('strong-pass-123'));
});
