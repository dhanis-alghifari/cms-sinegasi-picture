import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type MaybePromise<T> = T | Promise<T>;

export interface LoginRateLimiter {
  isLimited(key: string): MaybePromise<boolean>;
  recordFailure(key: string): MaybePromise<void>;
  clear(key: string): MaybePromise<void>;
}

type LoginAttempt = { count: number; windowStartedAt: number };

export function createLoginRateLimiter(
  windowMs = 5 * 60 * 1000,
  maxAttempts = 10,
  maxEntries = 10_000,
): LoginRateLimiter {
  const attempts = new Map<string, LoginAttempt>();

  function getCurrent(key: string, now: number): LoginAttempt | undefined {
    const current = attempts.get(key);
    if (current && now - current.windowStartedAt < windowMs) return current;
    attempts.delete(key);
    return undefined;
  }

  function enforceCapacity(): void {
    while (attempts.size > maxEntries) {
      const oldestKey = attempts.keys().next().value as string | undefined;
      if (!oldestKey) return;
      attempts.delete(oldestKey);
    }
  }

  return {
    isLimited(key) {
      const current = getCurrent(key, Date.now());
      return Boolean(current && current.count >= maxAttempts);
    },
    recordFailure(key) {
      const now = Date.now();
      const current = getCurrent(key, now);
      if (!current) attempts.set(key, { count: 1, windowStartedAt: now });
      else current.count += 1;
      enforceCapacity();
    },
    clear(key) {
      attempts.delete(key);
    },
  };
}

type SupabaseLike = SupabaseClient | null;

/**
 * Uses atomic Postgres functions when migration 027 is present. If the
 * migration is not yet deployed or the store is unavailable, it falls back to
 * the bounded process-local limiter instead of making login fail open.
 */
export function createSupabaseLoginRateLimiter(
  client: SupabaseLike,
  fallback = createLoginRateLimiter(),
  windowSeconds = 300,
  maxAttempts = 10,
): LoginRateLimiter {
  if (!client) return fallback;

  function hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  return {
    async isLimited(key) {
      try {
        const { data, error } = await client.rpc('is_login_rate_limited', {
          p_rate_key: hashKey(key),
          p_window_seconds: windowSeconds,
          p_max_attempts: maxAttempts,
        });
        if (!error) return Boolean(Array.isArray(data) ? data[0] : data);
      } catch {
        // Fall back during migration rollout or a transient database outage.
      }
      return await fallback.isLimited(key);
    },
    async recordFailure(key) {
      try {
        const { error } = await client.rpc('record_login_failure', {
          p_rate_key: hashKey(key),
          p_window_seconds: windowSeconds,
        });
        if (!error) return;
      } catch {
        // Fall back during migration rollout or a transient database outage.
      }
      await fallback.recordFailure(key);
    },
    async clear(key) {
      try {
        const { error } = await client.rpc('clear_login_rate_limit', { p_rate_key: hashKey(key) });
        if (!error) return;
      } catch {
        // Fall back during migration rollout or a transient database outage.
      }
      await fallback.clear(key);
    },
  };
}
