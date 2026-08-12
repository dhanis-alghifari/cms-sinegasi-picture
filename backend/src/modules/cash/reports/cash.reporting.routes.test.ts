import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import cashReportingRoutes from './cash.reporting.routes.js';

test('cash reporting routes keep manager guard and response envelopes', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(cashReportingRoutes, {
    reportingService: {
      repositoryIsConfigured: () => false,
      getReport: async () => ({ period: { start_date: '2026-08-01', end_date: '2026-08-01', days: 1 }, summary: {} }),
      listDebts: async () => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
      getBillingRules: async () => ({ nominal_iuran_wajib: 5000, holiday_start_date: null, holiday_end_date: null, skip_week: false }),
      updateBillingRules: async () => ({ nominal_iuran_wajib: 6000, holiday_start_date: null, holiday_end_date: null, skip_week: false }),
    } as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());
  const teacher = app.jwt.sign({ userId: 'usr-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const member = app.jwt.sign({ userId: 'usr-2', username: 'member', role: 'member', studentId: '123e4567-e89b-12d3-a456-426614174000', isFirstLogin: false });
  const report = await app.inject({ method: 'GET', url: '/api/cash/report?start_date=2026-08-01&end_date=2026-08-01', headers: { authorization: `Bearer ${teacher}` } });
  assert.equal(report.statusCode, 200);
  assert.equal(report.json().success, true);
  const denied = await app.inject({ method: 'GET', url: '/api/cash/report', headers: { authorization: `Bearer ${member}` } });
  assert.equal(denied.statusCode, 403);
  const update = await app.inject({ method: 'PUT', url: '/api/cash/billing-rules', headers: { authorization: `Bearer ${teacher}`, 'x-change-reason': 'Perubahan aturan' }, payload: { nominal_iuran_wajib: 6000 } });
  assert.equal(update.statusCode, 200);
});
