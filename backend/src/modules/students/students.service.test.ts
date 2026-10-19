import assert from 'node:assert/strict';
import test from 'node:test';
import { StudentNotFoundError, StudentService, StudentServiceError } from './students.service.js';
import { createStudentsMemoryState } from './students.helpers.js';
import { createStudentRepository, type StudentRepository } from './students.repository.js';
import type { StudentAccountOperationContext, StudentCreateInput } from './students.types.js';

let operationSequence = 0;

function operationContext(): StudentAccountOperationContext {
  operationSequence += 1;
  return {
    operationKey: `00000000-0000-4000-8000-${String(operationSequence).padStart(12, '0')}`,
    changeReason: 'Pembuatan akun siswa untuk pengujian',
  };
}

function createStudent(
  service: StudentService,
  input: Omit<StudentCreateInput, 'username'> & Partial<Pick<StudentCreateInput, 'username'>>,
  actorId = 'secretary-1',
  context = operationContext(),
) {
  const username = input.username ?? `siswa${operationSequence + 1}`;
  return service.create({ no_telepon: '081234567890', ...input, username }, actorId, context);
}

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
  const created = await createStudent(service, { nis: '20260010', nama: 'Sinta', kelas: 'X TB 1', peminatan: 'editing', username: 'sinta' });
  assert.equal(created.data.student.nama, 'Sinta');
  assert.equal(created.data.account.role, 'member');
  assert.equal(created.data.account.username, 'sinta');
  const leader = await createStudent(service, { nis: '20260011', nama: 'Raka', kelas: 'X TB 1', role: 'leader', username: 'raka' });
  assert.equal(leader.data.account.role, 'leader');
  await assert.rejects(
    createStudent(service, { nis: '20260012', nama: 'Tono', kelas: 'X TB 1', role: 'teacher', username: 'tono' }),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'INVALID_ACCOUNT_ROLE',
  );
  const treasurer = await createStudent(service, { nis: '20260013', nama: 'Dina', kelas: 'X TB 1', role: 'treasurer', username: 'dina' });
  assert.equal(treasurer.data.account.role, 'treasurer');
  await assert.rejects(
    createStudent(service, { nis: '20260010', nama: 'Sinta Lain', kelas: 'X TB 2', username: 'sinta.lain' }),
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
    'https://example.test/public-student.png',
    'https://example.test/student.png\n',
  ]) {
    await assert.rejects(
      createStudent(service, { nis: '20260030', nama: 'Foto Siswa', kelas: 'X TB 1', foto_url }),
      (error: unknown) => error instanceof StudentServiceError && error.errorCode === 'INVALID_PHOTO_URL',
    );
  }
  assert.equal(state.students.length, 0);
  assert.equal(state.accounts.length, 0);
});

test('student photos preserve optional empty values and canonical PNG support', async () => {
  const state = createStudentsMemoryState();
  const service = new StudentService(createStudentRepository(null, state));
  const withoutPhoto = await createStudent(service, { nis: '20260031', nama: 'Tanpa Foto', kelas: 'X TB 1', foto_url: '' });
  assert.equal(withoutPhoto.data.student.foto_url, undefined);
  const foto_url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
  const withPhoto = await createStudent(service, { nis: '20260032', nama: 'Dengan Foto', kelas: 'X TB 1', foto_url });
  assert.equal(withPhoto.data.student.foto_url, foto_url);
});

test('linked student photo-only update preserves profile and forwards the normalized audit reason', async () => {
  const state = createStudentsMemoryState();
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
  const previous = {
    id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222',
    nis: 'TEST-001', nama: 'Siswa Uji', kelas: 'X Uji', peminatan: 'naskah',
    no_telepon: '+6281234567890', is_active: true, created_at: '2026-01-01T00:00:00Z',
  };
  state.students.push(previous);
  const base = createStudentRepository(null, state);
  const calls: Array<Parameters<NonNullable<StudentRepository['updateProfile']>>[0]> = [];
  const repository: StudentRepository = {
    ...base, isConfigured: () => true,
    async updateProfile(input) { calls.push(input); return base.updateProfile!(input); },
  };
  const service = new StudentService(repository);
  const actorId = '33333333-3333-4333-8333-333333333333';
  const result = await service.update(previous.id, { foto_url: photo }, actorId, '  Ubah foto pengujian  ', false);
  assert.deepEqual(calls, [{
    id: previous.id, actorId, changeReason: 'Ubah foto pengujian',
    changes: { nama: previous.nama, kelas: previous.kelas, peminatan: previous.peminatan, no_telepon: previous.no_telepon, foto_url: photo },
  }]);
  assert.equal(result.data.user_id, previous.user_id);
  assert.equal(result.data.foto_url, photo);
  assert.equal(result.data.no_telepon, previous.no_telepon);

  await service.update(previous.id, { nama: 'Nama Uji Baru' }, actorId, 'Koreksi nama pengujian', false);
  assert.equal(calls[1].changes.kelas, previous.kelas);
  assert.equal(calls[1].changes.foto_url, photo);
  await service.update(previous.id, { foto_url: '' }, actorId, 'Hapus foto pengujian', false);
  assert.equal(calls[2].changes.foto_url, undefined);
  assert.equal(calls[2].changes.no_telepon, previous.no_telepon);

  for (const reason of ['', 'a'.repeat(501)]) {
    await assert.rejects(service.update(previous.id, { foto_url: photo }, actorId, reason, false),
      (error: unknown) => error instanceof StudentServiceError && error.errorCode === 'INVALID_CHANGE_REASON');
  }
  await assert.rejects(service.update(previous.id, { foto_url: photo }, null, 'Ubah foto pengujian', false),
    (error: unknown) => error instanceof StudentServiceError && error.errorCode === 'DATABASE_IDENTITY_UNAVAILABLE');
  assert.equal(calls.length, 3, 'invalid audit context must not reach the mutation');
});

test('student account creation normalizes manual usernames and requires an Indonesian WhatsApp number', async () => {
  const state = createStudentsMemoryState();
  const service = new StudentService(createStudentRepository(null, state));
  const created = await createStudent(service, {
    nis: '20260100', nama: 'Rara', kelas: 'X TB 1', username: '  RARA.Putri  ',
  });
  assert.equal(created.data.account.username, 'rara.putri');
  assert.equal(created.data.student.no_telepon, '+6281234567890');

  await assert.rejects(
    createStudent(service, { nis: '20260101', nama: 'Rani', kelas: 'X TB 1', username: 'RARA.PUTRI' }),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'USERNAME_TAKEN',
  );
  await assert.rejects(
    createStudent(service, { nis: '20260102', nama: 'Dodi', kelas: 'X TB 1', no_telepon: '0812abc' }),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'INVALID_WHATSAPP_NUMBER',
  );
});

test('retrying a successful account request never returns its temporary password twice', async () => {
  const state = createStudentsMemoryState();
  const service = new StudentService(createStudentRepository(null, state));
  const input = { nis: '20260110', nama: 'Salsa', kelas: 'X TB 1', username: 'salsa' };
  const context = operationContext();
  const first = await createStudent(service, input, 'secretary-1', context);
  const replay = await createStudent(service, input, 'secretary-1', context);

  assert.ok(first.temporaryPassword);
  assert.equal(first.data.account.operation_replayed, false);
  assert.equal(replay.temporaryPassword, undefined);
  assert.equal(replay.data.account.operation_replayed, true);
  assert.equal(replay.data.account.user_id, first.data.account.user_id);
  assert.equal(state.students.length, 1);
  assert.equal(state.accounts.length, 1);
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
