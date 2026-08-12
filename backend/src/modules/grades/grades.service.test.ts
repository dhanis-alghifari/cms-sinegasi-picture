import assert from 'node:assert/strict';
import test from 'node:test';
import { createGradesRepository } from './grades.repository.js';
import { GradesService, GradesServiceError } from './grades.service.js';

test('grades service validates assignment and bulk grade workflows in memory', async () => {
  const service = new GradesService(createGradesRepository(null, { grades: [], assignments: [] }));
  const assignment = await service.createAssignment({ title: 'Lighting Lab', category: 'Kelas', date: '2026-08-20' }, 'teacher-1');
  assert.equal(assignment.category, 'class_task');
  const result = await service.bulkGrade({ assignment_id: assignment.id, grades: [{ student_id: '11111111-1111-1111-1111-111111111111', nilai: 'A' }] }, 'teacher-1', 'Nilai sudah diverifikasi');
  assert.equal(result.count, 1);
});

test('grades service rejects unknown categories and missing audit reasons', async () => {
  const service = new GradesService(createGradesRepository(null, { grades: [], assignments: [] }));
  await assert.rejects(() => service.listGrades({ category: 'unknown' }), (error: unknown) => error instanceof GradesServiceError && error.statusCode === 422);
  await assert.rejects(() => service.bulkGrade({ assignment_id: 'asg-1', grades: [{ student_id: '11111111-1111-1111-1111-111111111111', nilai: 'A' }] }, 'teacher-1'), (error: unknown) => error instanceof GradesServiceError && error.statusCode === 422);
});
