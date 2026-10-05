import { createHash } from 'node:crypto';

export interface ApiRateLimitPolicy {
  readonly name: string;
  readonly maxRequests: number;
  readonly windowSeconds: number;
}

export interface ApiRateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
}

/** A store consumes one request atomically; callers never inspect then increment. */
export interface ApiRateLimitStore {
  consume(key: string, policy: ApiRateLimitPolicy): Promise<ApiRateLimitDecision>;
}

export class ApiRateLimitUnavailableError extends Error {
  constructor() {
    super('API rate-limit store unavailable');
    this.name = 'ApiRateLimitUnavailableError';
  }
}

export const API_RATE_LIMIT_POLICIES = {
  ip: { name: 'ip', maxRequests: 1_200, windowSeconds: 60 },
  loginIp: { name: 'login-ip', maxRequests: 180, windowSeconds: 60 },
  account: { name: 'account', maxRequests: 180, windowSeconds: 60 },
  upload: { name: 'upload', maxRequests: 60, windowSeconds: 60 },
  credentials: { name: 'credentials', maxRequests: 10, windowSeconds: 300 },
  sensitiveRead: { name: 'sensitive-read', maxRequests: 60, windowSeconds: 60 },
  report: { name: 'report', maxRequests: 10, windowSeconds: 60 },
  write: { name: 'write', maxRequests: 60, windowSeconds: 60 },
} as const satisfies Record<string, ApiRateLimitPolicy>;

/** Only registered route templates enter policies; IDs and query strings cannot create buckets. */
export function getApiRateLimitPolicies(method: string, route: string): readonly ApiRateLimitPolicy[] {
  const policies: ApiRateLimitPolicy[] = [API_RATE_LIMIT_POLICIES.account];
  const writes = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (writes) policies.push(API_RATE_LIMIT_POLICIES.write);

  if (writes && (/(?:uploads?|photos?|evidence)(?:\/|$|-)/i.test(route)
    || route === '/api/cash/disputes'
    || /^\/api\/(?:students|equipment)(?:\/:id)?$/.test(route))) {
    policies.push(API_RATE_LIMIT_POLICIES.upload);
  }
  if (writes && (/\/(?:reset-password|change-password|provision-account|link-account|unlink-account)(?:\/|$)/.test(route)
    || /^\/api\/users(?:\/|$)/.test(route)
    || /^\/api\/students(?:\/:id)?(?:\/account-links)?$/.test(route)
    || route.startsWith('/api/access-control/'))) {
    policies.push(API_RATE_LIMIT_POLICIES.credentials);
  }
  if (['GET', 'HEAD'].includes(method) && /^\/api\/(?:students|users|grades|attendance|audit)(?:\/|$)/.test(route)) {
    policies.push(API_RATE_LIMIT_POLICIES.sensitiveRead);
  }
  if (/\/(?:export|exports|report|reports)(?:\/|$)/.test(route)) {
    policies.push(API_RATE_LIMIT_POLICIES.report);
  }
  return policies;
}

/** Never persist a raw IP, token, request URL, or user identifier in the counter table. */
export function getApiRateLimitKey(principal: string, policy: ApiRateLimitPolicy): string {
  return createHash('sha256')
    .update(JSON.stringify(['api-rate-limit-v1', policy.name, policy.windowSeconds, policy.maxRequests, principal]))
    .digest('hex');
}

interface MemoryCounter {
  count: number;
  resetAt: number;
}

export function createMemoryApiRateLimitStore(
  now: () => number = Date.now,
  maxEntries = 10_000,
): ApiRateLimitStore {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new Error('Invalid rate-limit capacity');
  const counters = new Map<string, MemoryCounter>();
  let nextCleanupAt = 0;

  return {
    async consume(key, policy) {
      const currentTime = now();
      if (currentTime >= nextCleanupAt) {
        for (const [existingKey, counter] of counters) {
          if (counter.resetAt <= currentTime) counters.delete(existingKey);
        }
        nextCleanupAt = currentTime + 1_000;
      }
      let counter = counters.get(key);
      if (counter && counter.resetAt <= currentTime) {
        counters.delete(key);
        counter = undefined;
      }
      if (!counter) {
        // Evicting an active counter would let key churn reset another user's quota.
        if (counters.size >= maxEntries) throw new ApiRateLimitUnavailableError();
        const windowMs = policy.windowSeconds * 1_000;
        counter = { count: 0, resetAt: (Math.floor(currentTime / windowMs) + 1) * windowMs };
        counters.set(key, counter);
      }
      counter.count = Math.min(counter.count + 1, policy.maxRequests + 1);
      return {
        allowed: counter.count <= policy.maxRequests,
        limit: policy.maxRequests,
        remaining: Math.max(0, policy.maxRequests - counter.count),
        resetAt: counter.resetAt,
      };
    },
  };
}

/**
 * The local prefilter rejects hot keys without a database round trip. Public
 * deployments still require a shared decision; restarting a worker is not a quota reset.
 */
export function createApiRateLimitStore(options: {
  shared: ApiRateLimitStore | null;
  persistentRequired: boolean;
  now?: () => number;
  maxEntries?: number;
  maxPendingOperations?: number;
}): ApiRateLimitStore {
  const now = options.now ?? Date.now;
  const prefilter = createMemoryApiRateLimitStore(now, options.maxEntries);
  let unavailableUntil = 0;
  let pendingOperations = 0;
  const maxPendingOperations = options.maxPendingOperations ?? 128;
  if (!Number.isSafeInteger(maxPendingOperations) || maxPendingOperations < 1) {
    throw new Error('Invalid rate-limit concurrency');
  }

  return {
    async consume(key, policy) {
      const localDecision = await prefilter.consume(key, policy);
      if (!localDecision.allowed) return localDecision;
      if (!options.shared) {
        if (options.persistentRequired) throw new ApiRateLimitUnavailableError();
        return localDecision;
      }
      if (now() < unavailableUntil) {
        if (options.persistentRequired) throw new ApiRateLimitUnavailableError();
        return localDecision;
      }
      if (pendingOperations >= maxPendingOperations) {
        if (options.persistentRequired) throw new ApiRateLimitUnavailableError();
        return localDecision;
      }
      pendingOperations += 1;
      try {
        return await options.shared.consume(key, policy);
      } catch {
        // Do not log provider errors or principal keys; they may carry credentials/PII.
        unavailableUntil = now() + 5_000;
        if (options.persistentRequired) throw new ApiRateLimitUnavailableError();
        return localDecision;
      } finally {
        pendingOperations -= 1;
      }
    },
  };
}
