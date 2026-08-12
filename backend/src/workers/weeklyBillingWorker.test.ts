import assert from 'node:assert/strict';
import test from 'node:test';
import { millisecondsUntilNextMondayMidnight, startWeeklyBillingWorker } from './weeklyBillingWorker.js';
import type { BillingService } from '../modules/billing/billing.service.js';

test('weekly billing worker schedules the injected service without running it during startup', () => {
  const service = {
    runWeeklyBillingCheck: async () => ({ studentsBilled: 0, totalNominal: 0, status: 'completed' }),
  } as BillingService;
  const logs: string[] = [];
  const fastify = {
    log: {
      info: (_payload: unknown, message: string) => logs.push(message),
      error: () => logs.push('error'),
    },
  } as any;

  const handle = startWeeklyBillingWorker(fastify, service);
  handle.stop();

  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.includes('Scheduled for Monday'), true);
});

test('weekly billing worker calculates the next Monday midnight delay', () => {
  const sundayNight = new Date(2026, 7, 9, 23, 0, 0, 0);
  assert.equal(millisecondsUntilNextMondayMidnight(sundayNight), 60 * 60 * 1000);
});
