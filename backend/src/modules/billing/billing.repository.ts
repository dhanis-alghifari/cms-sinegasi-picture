import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_UNAVAILABLE_BILLING_RESULT, normalizeBillingResult } from './billing.helpers.js';
import type { BillingRepository, BillingRepositoryError } from './billing.types.js';

type SupabaseLike = SupabaseClient | null;

function toError(error: unknown): BillingRepositoryError | null {
  if (!error) return null;
  const candidate = error as BillingRepositoryError;
  return {
    code: candidate.code,
    message: candidate.message,
    details: candidate.details,
  };
}

/**
 * Owns the single database boundary for weekly billing. The RPC keeps the
 * transaction, locking, settings, and idempotency rules inside Postgres.
 */
export function createBillingRepository(client: SupabaseLike): BillingRepository {
  return {
    isConfigured: () => client !== null,

    async generateWeeklyBilling(runDate) {
      if (!client) {
        return { data: DATABASE_UNAVAILABLE_BILLING_RESULT, error: null };
      }

      const { data, error } = await client.rpc('generate_weekly_cash_billing', {
        p_run_date: runDate,
      });
      if (error) return { data: null, error: toError(error) };

      const result = Array.isArray(data) ? data[0] : data;
      return { data: normalizeBillingResult(result), error: null };
    },
  };
}
