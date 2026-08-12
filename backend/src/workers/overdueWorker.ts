import type { FastifyInstance } from 'fastify';
import { OverdueService } from '../modules/overdue/overdue.service.js';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Scheduler adapter only. Querying, notification delivery, audit idempotency,
 * and result calculation belong to OverdueService.
 */
export function startOverdueWorker(
  fastify: FastifyInstance,
  overdueService: OverdueService,
  intervalMs = DEFAULT_INTERVAL_MS,
): NodeJS.Timeout {
  fastify.log.info(`[OverdueWorker] Scheduled overdue check every ${intervalMs / 60000} minutes.`);

  void overdueService.runCheck().catch((error: unknown) => {
    fastify.log.error({ error }, '[OverdueWorker] Error on initial check.');
  });

  return setInterval(() => {
    void overdueService.runCheck().catch((error: unknown) => {
      fastify.log.error({ error }, '[OverdueWorker] Error in scheduled check.');
    });
  }, intervalMs);
}
