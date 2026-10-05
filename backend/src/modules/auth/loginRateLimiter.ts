import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type MaybePromise<T> = T | Promise<T>;

export interface LoginRateLimiter {
  isLimited(key: string): MaybePromise<boolean>;
  recordFailure(key: string): MaybePromise<void>;
  clear(key: string): MaybePromise<void>;
}

type LoginAttempt = { count: number; windowStartedAt: number };

export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 300;
const STORE_TIMEOUT_MS = 2_000;
const MAX_KEY_LENGTH = 1_024;

export class LoginRateLimitUnavailableError extends Error {
  constructor() {
    super('Login rate limiter unavailable');
    this.name = 'LoginRateLimitUnavailableError';
  }
}

/** Separate namespaces prevent the account counter from changing with the IP. */
export function getLoginRateLimitKeys(ip: string, username: string): readonly [string, string] {
  const trimmedUsername = username.trim();
  if (!trimmedUsername || trimmedUsername.length > 64 || !ip || ip.length > 128) {
    throw new LoginRateLimitUnavailableError();
  }
  const canonicalUsername = trimmedUsername.toLowerCase();
  return [
    JSON.stringify(['login-account-v2', canonicalUsername]),
    JSON.stringify(['login-ip-account-v2', ip, canonicalUsername]),
  ];
}

function hashKey(key: string): string {
  if (!key || key.length > MAX_KEY_LENGTH) throw new LoginRateLimitUnavailableError();
  return crypto.createHash('sha256').update(key).digest('hex');
}

function validatePositiveInteger(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid login limiter configuration');
}

export function createLoginRateLimiter(
  windowMs = LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1_000,
  maxAttempts = 10,
  maxEntries = 10_000,
  now: () => number = Date.now,
): LoginRateLimiter {
  [windowMs, maxAttempts, maxEntries].forEach(validatePositiveInteger);
  const attempts = new Map<string, LoginAttempt>();
  let lastCleanupAt = 0;

  function getCurrent(key: string, now: number): LoginAttempt | undefined {
    const current = attempts.get(key);
    if (current && now - current.windowStartedAt < windowMs) return current;
    attempts.delete(key);
    return undefined;
  }

  function cleanExpired(timestamp: number): void {
    if (timestamp - lastCleanupAt < 1_000 && attempts.size < maxEntries) return;
    lastCleanupAt = timestamp;
    for (const [key, current] of attempts) {
      if (timestamp - current.windowStartedAt >= windowMs) attempts.delete(key);
    }
  }

  function requireCapacity(key: string, timestamp: number): void {
    cleanExpired(timestamp);
    // Never evict a live counter: key churn must not unlock an existing account.
    if (!attempts.has(key) && attempts.size >= maxEntries) throw new LoginRateLimitUnavailableError();
  }

  return {
    isLimited(key) {
      const storageKey = hashKey(key);
      const timestamp = now();
      const current = getCurrent(storageKey, timestamp);
      requireCapacity(storageKey, timestamp);
      return Boolean(current && current.count >= maxAttempts);
    },
    recordFailure(key) {
      const storageKey = hashKey(key);
      const timestamp = now();
      const current = getCurrent(storageKey, timestamp);
      requireCapacity(storageKey, timestamp);
      if (!current) attempts.set(storageKey, { count: 1, windowStartedAt: timestamp });
      else current.count = Math.min(maxAttempts, current.count + 1);
    },
    clear(key) {
      attempts.delete(hashKey(key));
    },
  };
}

type SupabaseLike = SupabaseClient | null;
interface LoginRateLimiterOptions {
  persistentRequired?: boolean;
}

/**
 * Migration 027 provides shared failure counters. Public deployments fail
 * closed on store failure; only isolated local development may fall back.
 */
export function createSupabaseLoginRateLimiter(
  client: SupabaseLike,
  fallback = createLoginRateLimiter(),
  windowSeconds = LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  maxAttempts = 10,
  options: LoginRateLimiterOptions = {},
): LoginRateLimiter {
  [windowSeconds, maxAttempts].forEach(validatePositiveInteger);
  if (!client) {
    if (!options.persistentRequired) return fallback;
    const unavailable = (): never => { throw new LoginRateLimitUnavailableError(); };
    return { isLimited: unavailable, recordFailure: unavailable, clear: unavailable };
  }

  async function withStore<T>(operation: () => Promise<T>, localOperation: () => MaybePromise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      if (options.persistentRequired) throw new LoginRateLimitUnavailableError();
      return await localOperation();
    }
  }

  return {
    async isLimited(key) {
      const storageKey = hashKey(key);
      return withStore(async () => {
        const { data, error } = await client.rpc('is_login_rate_limited', {
          p_rate_key: storageKey,
          p_window_seconds: windowSeconds,
          p_max_attempts: maxAttempts,
        }).abortSignal(AbortSignal.timeout(STORE_TIMEOUT_MS));
        if (error || typeof data !== 'boolean') throw new LoginRateLimitUnavailableError();
        return data;
      }, () => fallback.isLimited(key));
    },
    async recordFailure(key) {
      const storageKey = hashKey(key);
      return withStore(async () => {
        const { error } = await client.rpc('record_login_failure', {
          p_rate_key: storageKey,
          p_window_seconds: windowSeconds,
        }).abortSignal(AbortSignal.timeout(STORE_TIMEOUT_MS));
        if (error) throw new LoginRateLimitUnavailableError();
      }, () => fallback.recordFailure(key));
    },
    async clear(key) {
      const storageKey = hashKey(key);
      return withStore(async () => {
        const { error } = await client.rpc('clear_login_rate_limit', { p_rate_key: storageKey })
          .abortSignal(AbortSignal.timeout(STORE_TIMEOUT_MS));
        if (error) throw new LoginRateLimitUnavailableError();
      }, () => fallback.clear(key));
    },
  };
}
