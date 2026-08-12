import assert from 'node:assert/strict';
import test from 'node:test';
import { startOverdueWorker } from './overdueWorker.js';
import type { OverdueService } from '../modules/overdue/overdue.service.js';

test('overdue worker schedules the injected service and performs one initial check', async () => {
  let calls = 0;
  const service = {
    runCheck: async () => {
      calls++;
      return { checkedCount: 0, overdueCount: 0, notifiedCount: 0 };
    },
  } as OverdueService;
  const logs: string[] = [];
  const fastify = {
    log: {
      info: (message: string) => logs.push(message),
      error: () => logs.push('error'),
    },
  } as any;

  const timer = startOverdueWorker(fastify, service, 60_000);
  await new Promise<void>((resolve) => setImmediate(resolve));
  clearInterval(timer);

  assert.equal(calls, 1);
  assert.equal(logs[0]?.includes('Scheduled overdue check'), true);
});
