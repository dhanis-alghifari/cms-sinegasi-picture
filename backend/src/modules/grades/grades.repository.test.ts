import assert from 'node:assert/strict';
import test from 'node:test';
import { createGradesRepository } from './grades.repository.js';

const ownStudentId = '11111111-1111-1111-1111-111111111111';
const otherStudentId = '22222222-2222-2222-2222-222222222222';

test('memory grade adapter filters before pagination and keeps personal search on assignment titles', async () => {
  const repository = createGradesRepository(null, {
    grades: [
      { id: 'g-1', assignment_id: 'a-1', assignment_title: 'Lighting Lab', assignment_category: 'class_task', student_id: ownStudentId, nilai: 'A', graded_by: 'teacher', created_at: '2026-08-01T00:00:00Z' },
      { id: 'g-2', assignment_id: 'a-2', assignment_title: 'Editing Lab', assignment_category: 'class_task', student_id: ownStudentId, nilai: 'B', graded_by: 'teacher', created_at: '2026-08-02T00:00:00Z' },
      { id: 'g-3', assignment_id: 'a-3', assignment_title: 'Lighting Lab', assignment_category: 'class_task', student_id: otherStudentId, student_nama: 'Other Student', nilai: 'E', graded_by: 'teacher', created_at: '2026-08-03T00:00:00Z' },
    ],
    assignments: [],
  });

  const result = await repository.listGrades({ scope: 'own', student_id: ownStudentId, search: 'lighting', page: '1', pageSize: '1' });
  assert.equal(result.error, null);
  assert.equal(result.data?.total, 1);
  assert.equal(result.data?.data[0]?.id, 'g-1');
});

test('memory assignment adapter limits personal tasks to the student class and global tasks', async () => {
  const repository = createGradesRepository(null, {
    grades: [
      { id: 'g-1', assignment_id: 'a-1', student_id: ownStudentId, kelas: 'XII DKV 1', nilai: 'A', graded_by: 'teacher', created_at: '2026-08-01T00:00:00Z' },
    ],
    assignments: [
      { id: 'a-own', title: 'Class task', category: 'class_task', kelas: 'XII', date: '2026-08-01', created_at: '2026-08-01T00:00:00Z' },
      { id: 'a-global', title: 'All students', category: 'class_task', kelas: 'Semua', date: '2026-08-02', created_at: '2026-08-02T00:00:00Z' },
      { id: 'a-other', title: 'Other class', category: 'class_task', kelas: 'XI', date: '2026-08-03', created_at: '2026-08-03T00:00:00Z' },
    ],
  });

  const result = await repository.listAssignments({ scope: 'own', student_id: ownStudentId, page: '1', pageSize: '10' });
  assert.equal(result.error, null);
  assert.deepEqual(result.data?.data.map((item) => item.id).sort(), ['a-global', 'a-own']);
});
