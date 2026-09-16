import crypto from 'node:crypto';
import { runtimeConfig } from '../config/env.js';

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: crypto.ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function assertPasswordPolicy(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password harus ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karakter.`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Password harus memiliki minimal satu huruf dan satu angka.');
  }
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 32 * 1024 * 1024,
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

/**
 * Verifies new scrypt hashes and supports legacy plaintext rows only so an
 * existing account can be upgraded on its next successful login.
 */
export async function verifyPassword(password: unknown, storedHash: unknown): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return { valid: false, needsRehash: false };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, needsRehash: false };
  }

  if (!storedHash.startsWith('scrypt$')) {
    return {
      valid: safeEqual(Buffer.from(password), Buffer.from(storedHash)),
      needsRehash: true,
    };
  }

  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return { valid: false, needsRehash: false };

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || n <= 1 || r <= 0 || p <= 0 || n > 1_048_576) {
    return { valid: false, needsRehash: false };
  }

  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length < 8 || expected.length !== KEY_LENGTH) return { valid: false, needsRehash: false };
    const actual = await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 32 * 1024 * 1024,
    });
    return { valid: safeEqual(actual, expected), needsRehash: false };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

export function createTemporaryPassword(prefix = 'Siswa'): string {
  if (runtimeConfig.environment !== 'production') {
    let candidate = (runtimeConfig.studentDefaultPassword || 'siswa123').trim();
    if (!/[A-Za-z]/.test(candidate)) {
      candidate = `Siswa${candidate}`;
    }
    if (!/\d/.test(candidate)) {
      candidate = `${candidate}123`;
    }
    if (candidate.length < PASSWORD_MIN_LENGTH) {
      candidate = candidate.padEnd(PASSWORD_MIN_LENGTH, '0');
    }
    if (candidate.length > PASSWORD_MAX_LENGTH) {
      candidate = candidate.slice(0, PASSWORD_MAX_LENGTH);
    }
    return candidate;
  }
  const digits = crypto.randomInt(100000, 1000000).toString();
  return `${prefix}-${digits}-${crypto.randomBytes(8).toString('base64url')}`;
}

/** Administrative resets must never use the shared development password. */
export function createSecureTemporaryPassword(prefix = 'Reset'): string {
  const guaranteedDigits = crypto.randomInt(100000, 1000000).toString();
  return `${prefix}-${guaranteedDigits}-${crypto.randomBytes(12).toString('base64url')}`;
}
