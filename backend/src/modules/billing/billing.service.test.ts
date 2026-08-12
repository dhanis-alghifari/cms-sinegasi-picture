import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingService, BillingServiceError } from './billing.service.js';
import type { BillingLogger, BillingRepository } from './billing.types.js';

function createLogger() {
  const entries: Array<{ level: string; message?: string }> = [];
  const logger: BillingLogger = {
    info: (_payload, message) => entries.push({ level: 'info', message }),
    warn: (_payload, message) => entries.push({ level: 'warn', message }),
    error: (_payload, message) => entries.push({ level: 'error', message }),
  };
  return { entries, logger };
}

test('billing service preserves the safe database-unavailable result', async () => {
  const { entries, logger } = createLogger();
  const repository: BillingRepository = {
    isConfigured: () => false,
    generateWeeklyBilling: async () => ({ data: null, error: null }),
  };

  const result = await new BillingService(repository, logger)
    .runWeeklyBillingCheck(new Date(2026, 7, 10));

  assert.deepEqual(result, { studentsBilled: 0, totalNominal: 0, status: 'database_unavailable' });
  assert.equal(entries[0]?.level, 'warn');
});

test('billing service passes a local run date and logs the completed result', async () => {
  const { entries, logger } = createLogger();
  let receivedRunDate = '';
  const repository: BillingRepository = {
    isConfigured: () => true,
    generateWeeklyBilling: async (runDate) => {
      receivedRunDate = runDate;
      return { data: { studentsBilled: 12, totalNominal: 1500, status: 'completed', billingWeek: '2026-W32' }, error: null };
    },
  };

  const result = await new BillingService(repository, logger)
    .runWeeklyBillingCheck(new Date(2026, 7, 10));

  assert.equal(receivedRunDate, '2026-08-10');
  assert.deepEqual(result, { studentsBilled: 12, totalNominal: 1500, status: 'completed', billingWeek: '2026-W32' });
  assert.equal(entries.at(-1)?.level, 'info');
});

test('billing service logs repository failures and hides database details from the thrown error', async () => {
  const { entries, logger } = createLogger();
  const repository: BillingRepository = {
    isConfigured: () => true,
    generateWeeklyBilling: async () => ({ data: null, error: { code: 'PGRST500', message: 'private database detail' } }),
  };

  await assert.rejects(
    () => new BillingService(repository, logger).runWeeklyBillingCheck(new Date(2026, 7, 10)),
    (error: unknown) => error instanceof BillingServiceError && error.message === 'Weekly billing generation failed.',
  );
  assert.equal(entries.at(-1)?.level, 'error');
});
