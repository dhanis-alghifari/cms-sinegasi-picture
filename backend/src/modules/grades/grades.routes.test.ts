import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import gradesRoutes from './grades.routes.js';

test('grades routes keep teacher guard and assignment response envelope', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(gradesRoutes, {
    gradesService: {
      repositoryIsConfigured: () => false,
      listGrades: async () => ({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }),
      listAssignments: async () => ({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }),
      createAssignment: async () => ({ id: 'asg-1', title: 'Task', category: 'class_task', date: '2026-08-20', created_at: new Date().toISOString() }),
      bulkGrade: async () => ({ data: [], count: 1 }),
      distribution: async () => ({ filters: { category: 'all', kelas: 'all', periode: 'all' }, totalAssignments: 0, data: [] }),
      studentSummary: async () => [],
    } as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());
  const member = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'POST', url: '/api/grades/assignments', headers: { authorization: `Bearer ${member}` }, payload: { title: 'Task', category: 'Kelas', date: '2026-08-20' } });
  assert.equal(denied.statusCode, 403);
  const teacher = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const accepted = await app.inject({ method: 'POST', url: '/api/grades/assignments', headers: { authorization: `Bearer ${teacher}` }, payload: { title: 'Task', category: 'Kelas', date: '2026-08-20' } });
  assert.equal(accepted.statusCode, 201);
  assert.equal(accepted.json().success, true);
});

test('grades own scope ignores caller supplied student and class filters', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let gradeQuery: Record<string, unknown> | undefined;
  let assignmentQuery: Record<string, unknown> | undefined;
  await app.register(gradesRoutes, {
    gradesService: {
      repositoryIsConfigured: () => false,
      listGrades: async (query: Record<string, unknown>) => { gradeQuery = query; return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }; },
      listAssignments: async (query: Record<string, unknown>) => { assignmentQuery = query; return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }; },
      summary: async () => ({ total: 0, counts: { A: 0, B: 0, C: 0, D: 0, E: 0 } }),
    } as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());
  const ownStudentId = '11111111-1111-1111-1111-111111111111';
  const member = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', studentId: ownStudentId, isFirstLogin: false });

  const grades = await app.inject({ method: 'GET', url: '/api/grades?scope=operational&student_id=22222222-2222-2222-2222-222222222222&class_name=XII', headers: { authorization: `Bearer ${member}` } });
  assert.equal(grades.statusCode, 200);
  assert.equal(gradeQuery?.student_id, ownStudentId);
  assert.equal(gradeQuery?.scope, 'own');
  assert.equal(gradeQuery?.kelas, undefined);

  const assignments = await app.inject({ method: 'GET', url: '/api/grades/assignments?scope=operational&class_name=XII', headers: { authorization: `Bearer ${member}` } });
  assert.equal(assignments.statusCode, 200);
  assert.equal(assignmentQuery?.student_id, ownStudentId);
  assert.equal(assignmentQuery?.scope, 'own');
  assert.equal(assignmentQuery?.kelas, undefined);
});
