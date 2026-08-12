import assert from 'node:assert/strict';
import test from 'node:test';
import { createDashboardMemoryState } from './dashboard.helpers.js';
import { createDashboardRepository } from './dashboard.repository.js';
import { DashboardService, DashboardServiceError } from './dashboard.service.js';

test('dashboard service preserves requested student id and fixture shape', async () => {
  const state = createDashboardMemoryState();
  const service = new DashboardService(createDashboardRepository(state));
  const summary = await service.getStudentSummary('student-42');

  assert.equal(summary.studentId, 'student-42');
  assert.equal(summary.attendance.hadir, 38);
  assert.equal(summary.cash.riwayat[0]?.status, 'lunas');
});

test('dashboard service rejects empty or control-character ids', async () => {
  const service = new DashboardService(createDashboardRepository(createDashboardMemoryState()));

  await assert.rejects(
    () => service.getStudentSummary('   '),
    (error: unknown) => error instanceof DashboardServiceError && error.statusCode === 422,
  );
  await assert.rejects(
    () => service.getStudentSummary('student-\u0000-42'),
    (error: unknown) => error instanceof DashboardServiceError && error.statusCode === 422,
  );
});
