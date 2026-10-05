import assert from 'node:assert/strict';
import test from 'node:test';
import { StudentNotFoundError, StudentService, StudentServiceError } from './students.service.js';
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
  const treasurer = await service.create({ nis: '20260013', nama: 'Dina', kelas: 'X TB 1', role: 'treasurer' }, 'secretary-1');
  assert.equal(treasurer.data.account.role, 'treasurer');
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

test('student photos reject unsupported data MIME, forged bytes and credential-bearing URLs', async () => {
  const state = createStudentsMemoryState();
  const service = new StudentService(createStudentRepository(null, state));
  for (const foto_url of [
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/png;base64,AAAA',
    'https://user:password@example.test/student.png',
    'https://example.test/student.png\n',
  ]) {
    await assert.rejects(
      service.create({ nis: '20260030', nama: 'Foto Siswa', kelas: 'X TB 1', foto_url }, 'secretary-1'),
      (error: unknown) => error instanceof StudentServiceError && error.errorCode === 'INVALID_PHOTO_URL',
    );
  }
  assert.equal(state.students.length, 0);
  assert.equal(state.accounts.length, 0);
});

test('student photos preserve optional empty values and canonical PNG support', async () => {
  const state = createStudentsMemoryState();
  const service = new StudentService(createStudentRepository(null, state));
  const withoutPhoto = await service.create({ nis: '20260031', nama: 'Tanpa Foto', kelas: 'X TB 1', foto_url: '' }, 'secretary-1');
  assert.equal(withoutPhoto.data.student.foto_url, undefined);
  const foto_url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
  const withPhoto = await service.create({ nis: '20260032', nama: 'Dengan Foto', kelas: 'X TB 1', foto_url }, 'secretary-1');
  assert.equal(withPhoto.data.student.foto_url, foto_url);
});

test('student service links an explicitly selected legacy account without provisioning credentials', async () => {
  const state = createStudentsMemoryState();
  const accountId = '33333333-3333-4333-a333-333333333333';
  const actorId = '44444444-4444-4444-a444-444444444444';
  state.accounts.push({
    id: accountId,
    username: 'bendahara',
    nama: 'Bendahara Ekstra',
    role: 'treasurer',
    is_active: true,
    is_first_login: false,
  });
  const service = new StudentService(createStudentRepository(null, state), () => state.students);

  const candidates = await service.listUnlinkedAccounts({ search: 'bendahara' }, actorId);
  assert.deepEqual(candidates, [{ id: accountId, username: 'bendahara', nama: 'Bendahara Ekstra', role: 'treasurer' }]);

  const result = await service.linkExistingAccount({
    userId: accountId,
    actorId,
    changeReason: 'Tautkan akun bendahara lama ke profil siswa',
    nis: '20260020',
    nama: 'Bendahara Ekstra',
    kelas: 'XI AK 1',
  });
  assert.equal(result.data.account.user_id, accountId);
  assert.equal(result.data.account.username, 'bendahara');
  assert.equal(result.data.account.role, 'treasurer');
  assert.equal(result.data.account.is_first_login, false);
  assert.equal(result.data.student.user_id, accountId);
  assert.equal(state.accounts[0].is_first_login, false);
  assert.deepEqual(await service.listUnlinkedAccounts({}, actorId), []);

  await assert.rejects(
    service.linkExistingAccount({
      userId: accountId,
      actorId,
      changeReason: 'Tautkan akun bendahara lama ke profil siswa',
      nis: '20260021',
      nama: 'Bendahara Ekstra',
      kelas: 'XI AK 1',
    }),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'STUDENT_ACCOUNT_NOT_ELIGIBLE',
  );
});

test('student service attaches an eligible legacy account to an existing unlinked profile', async () => {
  const state = createStudentsMemoryState();
  const accountId = '33333333-3333-4333-a333-333333333333';
  const studentId = '55555555-5555-4555-a555-555555555555';
  const actorId = '44444444-4444-4444-a444-444444444444';
  state.accounts.push({
    id: accountId,
    username: 'ketua',
    nama: 'Nama lama',
    role: 'leader',
    is_active: true,
    is_first_login: false,
  });
  state.students.push({
    id: studentId,
    nis: '20260022',
    nama: 'Ketua Ekstra',
    kelas: 'XI AK 1',
    is_active: true,
    created_at: new Date().toISOString(),
  });
  const service = new StudentService(createStudentRepository(null, state));

  const result = await service.linkAccountToExistingProfile({
    studentId,
    userId: accountId,
    actorId,
    changeReason: 'Tautkan akun ke profil siswa lama',
  });

  assert.equal(result.data.student.id, studentId);
  assert.equal(result.data.student.user_id, accountId);
  assert.equal(result.data.account.username, 'ketua');
  assert.equal(result.data.account.role, 'leader');
  assert.equal(result.data.account.is_first_login, false);
  assert.equal(state.accounts[0].nama, 'Ketua Ekstra');
  assert.equal(state.students.length, 1);
});
