/**
 * Weekly billing worker.
 * The database function owns the lock, settings, idempotency, and debt inserts.
 */

import { FastifyInstance } from 'fastify';
import type { BillingService } from '../modules/billing/billing.service.js';

export function millisecondsUntilNextMondayMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  return Math.max(1, next.getTime() - now.getTime());
}

export interface WeeklyBillingWorkerHandle {
  stop: () => void;
}

export function startWeeklyBillingWorker(
  fastify: FastifyInstance,
  billingService: BillingService,
): WeeklyBillingWorkerHandle {
  const weeklyMs = 7 * 24 * 60 * 60 * 1000;
  const delay = millisecondsUntilNextMondayMidnight(new Date());
  fastify.log.info({ delayMs: delay }, '[WeeklyBillingWorker] Scheduled for Monday 00:00 server time.');

  let timer!: NodeJS.Timeout;
  let stopped = false;
  const schedule = (waitMs: number) => {
    timer = setTimeout(() => {
      billingService.runWeeklyBillingCheck().catch((error) => {
        fastify.log.error({ error }, '[WeeklyBillingWorker] Scheduled check error.');
      }).finally(() => {
        if (!stopped) schedule(weeklyMs);
      });
    }, waitMs);
  };

  schedule(delay);
  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
