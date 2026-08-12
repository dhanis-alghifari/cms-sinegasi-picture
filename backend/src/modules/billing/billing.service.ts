import { DATABASE_UNAVAILABLE_BILLING_RESULT, toLocalDateString } from './billing.helpers.js';
import type { BillingLogger, BillingRepository, BillingResult } from './billing.types.js';

export class BillingServiceError extends Error {
  readonly code = 'WEEKLY_BILLING_FAILED';

  constructor(message = 'Weekly billing generation failed.', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BillingServiceError';
  }
}

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly logger: BillingLogger,
  ) {}

  async runWeeklyBillingCheck(runDate = new Date()): Promise<BillingResult> {
    const runDateString = toLocalDateString(runDate);
    if (!this.repository.isConfigured()) {
      this.logger.warn(
        { runDate: runDateString, reason: 'DATABASE_UNAVAILABLE' },
        '[SYSTEM:WEEKLY_BILLING] Supabase is not configured; billing was not generated.',
      );
      return DATABASE_UNAVAILABLE_BILLING_RESULT;
    }

    const { data, error } = await this.repository.generateWeeklyBilling(runDateString);
    if (error) {
      this.logger.error(
        { error, runDate: runDateString },
        '[SYSTEM:WEEKLY_BILLING] Billing generation failed.',
      );
      throw new BillingServiceError(undefined, { cause: error });
    }

    const output = data || DATABASE_UNAVAILABLE_BILLING_RESULT;
    this.logger.info(
      { ...output, reason: 'SYSTEM:WEEKLY_BILLING', runDate: runDateString },
      '[SYSTEM:WEEKLY_BILLING] Billing cycle completed.',
    );
    return output;
  }
}
