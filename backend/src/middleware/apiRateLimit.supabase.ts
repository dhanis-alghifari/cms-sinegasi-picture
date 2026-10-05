import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ApiRateLimitUnavailableError,
  type ApiRateLimitDecision,
  type ApiRateLimitStore,
} from './apiRateLimit.js';

export function createSupabaseApiRateLimitStore(client: SupabaseClient): ApiRateLimitStore {
  return {
    async consume(key, policy) {
      const { data, error } = await client.rpc('consume_api_rate_limit_atomic', {
        p_rate_key: key,
        p_window_seconds: policy.windowSeconds,
        p_max_requests: policy.maxRequests,
      }).abortSignal(AbortSignal.timeout(2_000));
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApiRateLimitUnavailableError();
      }
      const row = data as Record<string, unknown>;
      const resetAt = typeof row.reset_at === 'string' ? Date.parse(row.reset_at) : NaN;
      if (typeof row.allowed !== 'boolean'
        || row.limit !== policy.maxRequests
        || !Number.isSafeInteger(row.remaining)
        || Number(row.remaining) < 0
        || Number(row.remaining) > policy.maxRequests
        || (!row.allowed && row.remaining !== 0)
        || !Number.isFinite(resetAt)) {
        throw new ApiRateLimitUnavailableError();
      }
      return {
        allowed: row.allowed,
        limit: policy.maxRequests,
        remaining: Number(row.remaining),
        resetAt,
      } satisfies ApiRateLimitDecision;
    },
  };
}
