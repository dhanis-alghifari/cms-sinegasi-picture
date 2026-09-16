import assert from 'node:assert/strict';
import test from 'node:test';
import { StudentNotFoundError, StudentService } from './students.service.js';
import { createStudentsMemoryState } from './students.helpers.js';
import { createStudentRepository, type StudentRepository } from './students.repository.js';

test('student service reads by UUID or NIS through its repository seam', async () => {
  const repository: StudentRepository = {
    isConfigured: () => true,
    findByIdentifier: async (identifier) => ({
      data: identifier === 'S-001' ? { id: 'S-001', nis: '2026001', nama: 'Budi' } : null,
      error: null,
    }),
  };
  const service = new StudentService(repository, () => []);
  const student = await service.getByIdentifier('S-001');
  assert.equal(student.nama, 'Budi');
});

test('student service uses the in-memory adapter only when database is unavailable', async () => {
  const repository: StudentRepository = {
    isConfigured: () => false,
    findByIdentifier: async () => ({ data: null, error: null }),
  };
  const service = new StudentService(repository, () => [
    { id: 'mock-1', nis: 'NIS-1', nama: 'Mock Student' },
  ]);
  assert.equal((await service.getByIdentifier('NIS-1')).id, 'mock-1');
  await assert.rejects(service.getByIdentifier('missing'), StudentNotFoundError);
});

test('student service validates account creation, search pagination, and lifecycle invariants', async () => {
  const state = createStudentsMemoryState();
  const service = new StudentService(createStudentRepository(null, state), () => state.students);
  const created = await service.create({ nis: '20260010', nama: 'Sinta', kelas: 'X TB 1', peminatan: 'editing' }, 'secretary-1');
  assert.equal(created.data.student.nama, 'Sinta');
  assert.equal(created.data.account.role, 'member');
  const leader = await service.create({ nis: '20260011', nama: 'Raka', kelas: 'X TB 1', role: 'leader' }, 'secretary-1');
  assert.equal(leader.data.account.role, 'leader');
  await assert.rejects(
    service.create({ nis: '20260012', nama: 'Tono', kelas: 'X TB 1', role: 'teacher' }, 'secretary-1'),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'INVALID_ACCOUNT_ROLE',
  );
  await assert.rejects(
    service.create({ nis: '20260010', nama: 'Sinta Lain', kelas: 'X TB 2' }, 'secretary-1'),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 409,
  );
  const list = await service.list({ search: 'sinta', page: 1, pageSize: 1 });
  assert.equal(list.total, 1);
  await assert.rejects(
    service.update(created.data.student.id, { is_active: false }, 'secretary-1', 'Alumni', false),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 403,
  );
});
