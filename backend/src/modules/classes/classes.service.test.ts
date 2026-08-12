import assert from 'node:assert/strict';
import test from 'node:test';
import { createClassesMemoryState, sanitizeClassSearch } from './classes.helpers.js';
import { createClassesRepository } from './classes.repository.js';
import { ClassesService, ClassesServiceError } from './classes.service.js';

function service() {
  const state = createClassesMemoryState();
  return { service: new ClassesService(createClassesRepository(null, state)), state };
}

test('class search removes PostgREST wildcard characters', () => {
  const sanitized = sanitizeClassSearch('X_%()');
  assert.equal(sanitized.includes('_'), false);
  assert.equal(sanitized.includes('%'), false);
});

test('classes service lists bounded options and filters by level/status', async () => {
  const { service: classesService, state } = service();
  state.classes.push(...Array.from({ length: 600 }, (_, index) => ({
    id: `extra-${index}`,
    nama_kelas: `Extra ${index}`,
    tingkat: 'X' as const,
    is_active: true,
  })));
  state.classes[0].is_active = false;
  const options = await classesService.listActiveOptions();
  assert.equal(options.length, 500);
  assert.equal(options.some((item) => item.id === state.classes[0].id), false);

  const page = await classesService.list({ tingkat: 'XI', page: 1, pageSize: 2 });
  assert.equal(page.pageSize, 2);
  assert.equal(page.data.length, 2);
  assert.equal(page.data.every((item) => item.tingkat === 'XI'), true);
});

test('classes service validates levels, duplicate names, and change reasons', async () => {
  const { service: classesService } = service();
  await assert.rejects(
    classesService.create({ nama_kelas: 'X Film 1', tingkat: 'I' }, 'teacher-1'),
    (error: unknown) => error instanceof ClassesServiceError && error.errorCode === 'INVALID_LEVEL',
  );

  await assert.rejects(
    classesService.create({ nama_kelas: 'X TKJ 1', tingkat: 'X' }, 'teacher-1'),
    (error: unknown) => error instanceof ClassesServiceError && error.statusCode === 409,
  );

  await assert.rejects(
    classesService.update('cls-001', { nama_kelas: 'X TKJ Baru 1' }, 'teacher-1', 'no'),
    (error: unknown) => error instanceof ClassesServiceError && error.errorCode === 'INVALID_CHANGE_REASON',
  );
});

test('classes service creates, updates, and deactivates through one repository seam', async () => {
  const { service: classesService } = service();
  const created = await classesService.create({ nama_kelas: 'X Film 1', tingkat: 'X' }, 'teacher-1');
  assert.equal(created.is_active, true);
  const updated = await classesService.update(created.id, { nama_kelas: 'X Film Utama 1' }, 'teacher-1', 'Perbaikan nama kelas');
  assert.equal(updated.nama_kelas, 'X Film Utama 1');
  const deactivated = await classesService.deactivate(created.id, 'teacher-1', 'Menonaktifkan kelas lama');
  assert.equal(deactivated.is_active, false);
});
