import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createDashboardMemoryState } from './dashboard.helpers.js';
import { createDashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';
import dashboardRoutes from './dashboard.routes.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const state = createDashboardMemoryState();
  await app.register(dashboardRoutes, {
    dashboardService: new DashboardService(createDashboardRepository(state)),
  });
  return app;
}

test('student dashboard summary keeps authentication and response contract', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const unauthenticated = await app.inject({ method: 'GET', url: '/api/students/student-42/dashboard-summary' });
  assert.equal(unauthenticated.statusCode, 401);

  const teacherToken = app.jwt.sign({
    userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false,
  });
  const response = await app.inject({
    method: 'GET',
    url: '/api/students/student-42/dashboard-summary',
    headers: { authorization: `Bearer ${teacherToken}` },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.equal(response.json().studentId, 'student-42');
  assert.equal(response.json().profile.nama, 'Budi Santoso');
});

test('student dashboard summary preserves ownership guard for members', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const token = app.jwt.sign({
    userId: 'member-1', username: 'member', role: 'member',
    studentId: '11111111-1111-4111-8111-111111111111', isFirstLogin: false,
  });
  const allowed = await app.inject({
    method: 'GET',
    url: '/api/students/11111111-1111-4111-8111-111111111111/dashboard-summary',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(allowed.statusCode, 200);

  const denied = await app.inject({
    method: 'GET',
    url: '/api/students/22222222-2222-4222-8222-222222222222/dashboard-summary',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(denied.statusCode, 403);
});

test('role-scoped dashboard returns operational data only to teachers', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const teacherToken = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const teacher = await app.inject({ method: 'GET', url: '/api/dashboard/summary', headers: { authorization: `Bearer ${teacherToken}` } });
  assert.equal(teacher.statusCode, 200);
  assert.equal(teacher.json().scope, 'operational');

  const memberToken = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', studentId: 'student-42', isFirstLogin: false });
  const member = await app.inject({ method: 'GET', url: '/api/dashboard/summary', headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(member.statusCode, 200);
  assert.equal(member.json().scope, 'personal');
  assert.equal(member.json().studentId, 'student-42');
});
