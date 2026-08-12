import assert from 'node:assert/strict';
import test from 'node:test';
import { createUsersMemoryState } from './users.helpers.js';
import { createUsersRepository } from './users.repository.js';
import { UsersService, UsersServiceError } from './users.service.js';

function service() {
  const state = createUsersMemoryState();
  return { service: new UsersService(createUsersRepository(null, state)), state };
}

test('users service creates operational accounts with hashed-password adapter state', async () => {
  const { service: usersService, state } = service();
  const result = await usersService.create({
    username: 'new_teacher', nama: 'Guru Baru', role: 'teacher', password: 'Strong123',
  }, 'teacher-1');
  assert.equal(result.data.role, 'teacher');
  assert.equal(result.data.is_first_login, true);
  assert.equal(result.temporaryPassword, 'Strong123');
  assert.equal(state.passwordHashes.has(result.data.id), true);
  await assert.rejects(
    usersService.create({ username: 'student', nama: 'Siswa', role: 'member', password: 'Strong123' }, 'teacher-1'),
    (error: unknown) => error instanceof UsersServiceError && error.statusCode === 422,
  );
});

test('users service enforces linked-student invariants before update/delete', async () => {
  const { service: usersService, state } = service();
  const created = await usersService.create({ username: 'linked_user', nama: 'Siswa Tertaut', role: 'teacher', password: 'Strong123' }, 'teacher-1');
  state.linkedStudents.push({ id: created.data.id, nama: created.data.nama, is_active: false });

  await assert.rejects(
    usersService.update(created.data.id, { role: 'leader' }, 'teacher-1', 'Perubahan role'),
    (error: unknown) => error instanceof UsersServiceError && error.errorCode === 'LINKED_STUDENT_ROLE',
  );
  await assert.rejects(
    usersService.update(created.data.id, { is_active: true }, 'teacher-1', 'Aktifkan akun'),
    (error: unknown) => error instanceof UsersServiceError && error.errorCode === 'INACTIVE_STUDENT',
  );
  await assert.rejects(
    usersService.remove(created.data.id, 'teacher-1', 'Hapus akun'),
    (error: unknown) => error instanceof UsersServiceError && error.errorCode === 'LINKED_STUDENT',
  );
});

test('users service updates login username without changing the stable user id', async () => {
  const { service: usersService, state } = service();
  const first = await usersService.create({
    username: 'generated_member', nama: 'Member Generated', role: 'teacher', password: 'Strong123',
  }, 'teacher-1');
  const second = await usersService.create({
    username: 'existing_user', nama: 'Existing User', role: 'leader', password: 'Strong123',
  }, 'teacher-1');

  state.linkedStudents.push({ id: first.data.id, nama: first.data.nama, is_active: true });
  const updated = await usersService.update(
    first.data.id,
    { username: 'mustika.jaya' },
    'teacher-1',
    'Menyesuaikan username login siswa',
  );

  assert.equal(updated.data.id, first.data.id);
  assert.equal(updated.data.username, 'mustika.jaya');
  assert.equal(updated.previous?.username, 'generated_member');

  await assert.rejects(
    usersService.update(first.data.id, { username: second.data.username }, 'teacher-1', 'Menguji username duplikat'),
    (error: unknown) => error instanceof UsersServiceError
      && error.statusCode === 409
      && error.errorCode === 'DUPLICATE_USERNAME',
  );
});

test('users service resets password state and prevents self-delete', async () => {
  const { service: usersService } = service();
  const created = await usersService.create({ username: 'reset_user', nama: 'Reset User', role: 'leader', password: 'Strong123' }, 'teacher-1');
  const reset = await usersService.resetPassword(created.data.id, 'teacher-1', 'Reset karena lupa', 'reset-service-key-001');
  assert.equal(reset.userId, created.data.id);
  assert.equal(reset.data.is_first_login, true);
  assert.match(reset.temporaryPassword, /^Reset-\d{6}-/);
  await assert.rejects(
    usersService.resetPassword(created.data.id, 'teacher-1', 'Reset karena lupa', 'reset-service-key-001'),
    (error: unknown) => error instanceof UsersServiceError && error.errorCode === 'RESET_OPERATION_REPLAY',
  );
  await assert.rejects(
    usersService.remove(created.data.id, created.data.id, 'Hapus akun sendiri'),
    (error: unknown) => error instanceof UsersServiceError && error.errorCode === 'SELF_DELETE',
  );
});
