import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverdueLogStore } from './overdue.memory.js';
import { OverdueService } from './overdue.service.js';
import type {
  OverdueBorrowing,
  OverdueLogger,
  OverdueRepository,
} from './overdue.types.js';

test('overdue service orchestrates notifications, audit, and bounded logs', async () => {
  const now = Date.now();
  const borrowing: OverdueBorrowing = {
    id: 'bor-1',
    studentId: 'student-1',
    studentName: 'Siswa Satu',
    studentUserId: 'user-student-1',
    namaAlat: 'Kamera',
    dueAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'borrowed',
  };
  const futureBorrowing: OverdueBorrowing = {
    ...borrowing,
    id: 'bor-2',
    dueAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const notifications: string[] = [];
  let auditRecords = 0;
  const repository: OverdueRepository = {
    isConfigured: () => false,
    listManagerIds: async () => ({ data: ['user-manager-1'], error: null }),
    scanOverdueBorrowings: async (_now, onBatch) => {
      await onBatch([borrowing, futureBorrowing]);
      return { checkedCount: 2, error: null };
    },
    createNotification: async (input) => {
      notifications.push(input.userId);
      return { created: true, error: null };
    },
    listAuditedBorrowingIds: async () => ({ data: [], error: null }),
    recordAudit: async () => {
      auditRecords++;
      return { error: null };
    },
  };
  const loggerEntries: string[] = [];
  const logger: OverdueLogger = {
    info: (message) => loggerEntries.push(message),
    warn: (_payload, message) => loggerEntries.push(message),
    error: (_payload, message) => loggerEntries.push(message),
  };
  const service = new OverdueService(repository, createOverdueLogStore(), logger);

  const report = await service.runManualCheck();

  assert.deepEqual(notifications, ['user-student-1', 'user-manager-1']);
  assert.equal(auditRecords, 1);
  assert.deepEqual(report.result, { checkedCount: 2, overdueCount: 1, notifiedCount: 2 });
  assert.equal(report.logs.length, 1);
  assert.equal(report.logs[0]?.borrowingId, 'bor-1');
  assert.equal(loggerEntries.some((entry) => entry.includes('Done.')), true);
});
