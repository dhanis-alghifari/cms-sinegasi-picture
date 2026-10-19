import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createStudentsMemoryState } from './students.helpers.js';
import { createStudentRepository } from './students.repository.js';
import { StudentService } from './students.service.js';
import studentRoutes from './students.routes.js';
import { getCapabilities, setRoleCapabilities } from '../../middleware/capabilities.js';
import type { StudentRepository } from './students.types.js';

let accountOperationSequence = 0;

function accountRequestHeaders(headers: Record<string, string>) {
  accountOperationSequence += 1;
  return {
    ...headers,
    'x-idempotency-key': `00000000-0000-4000-8000-${String(accountOperationSequence).padStart(12, '0')}`,
  };
}

function accountPayload(payload: Record<string, unknown>) {
  accountOperationSequence += 1;
  return {
    username: `siswa${accountOperationSequence}`,
    phone_number: '081234567890',
    ...payload,
  };
}

async function createApp(state = createStudentsMemoryState(), routeCacheConfig?: Map<string, boolean>) {
  const app = Fastify();
  if (routeCacheConfig) {
    app.addHook('onRoute', (route) => {
      const config = route.config as { disableIdempotencyCache?: boolean } | undefined;
      if (route.method === 'POST') routeCacheConfig.set(route.url, config?.disableIdempotencyCache === true);
    });
  }
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(studentRoutes, {
    studentsService: new StudentService(createStudentRepository(null, state), () => state.students),
    persistAuditLog: async () => undefined,
  });
  return app;
}

test('student credential issuance explicitly disables response caching without disabling safe account linking', async (t) => {
  const routeCacheConfig = new Map<string, boolean>();
  const app = await createApp(createStudentsMemoryState(), routeCacheConfig);
  t.after(() => app.close());
  await app.ready();
  assert.equal(routeCacheConfig.get('/api/students'), true);
  assert.equal(routeCacheConfig.get('/api/students/:id/provision-account'), true);
  assert.equal(routeCacheConfig.get('/api/students/account-links'), false);
  assert.equal(routeCacheConfig.get('/api/students/:id/account-links'), false);
});

test('student management keeps secretary guard and account response contract', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const memberToken = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'GET', url: '/api/students', headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(denied.statusCode, 403);

  const secretaryToken = app.jwt.sign({ userId: 'secretary-1', username: 'secretary', role: 'secretary', isFirstLogin: false });
  const headers = { authorization: `Bearer ${secretaryToken}` };
  const budiRequestHeaders = accountRequestHeaders(headers);
  const budiPayload = accountPayload({ student_number: '20260001', name: 'Budi Santoso', class_name: 'X TKJ 1', specialization: 'kamera', username: 'budi.santoso' });
  const created = await app.inject({ method: 'POST', url: '/api/students', headers: budiRequestHeaders, payload: budiPayload });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().success, true);
  assert.equal(created.json().account.role, 'member');
  assert.equal(typeof created.json().account.temporary_password, 'string');
  assert.equal(created.json().account.username, 'budi.santoso');
  assert.equal(created.json().data.no_telepon, '+6281234567890');

  const replay = await app.inject({ method: 'POST', url: '/api/students', headers: budiRequestHeaders, payload: budiPayload });
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.json().account.operation_replayed, true);
  assert.equal('temporary_password' in replay.json().account, false);
  assert.equal(replay.json().account.user_id, created.json().account.user_id);

  const reusedKey = await app.inject({
    method: 'POST', url: '/api/students', headers: budiRequestHeaders,
    payload: { ...budiPayload, name: 'Payload berubah' },
  });
  assert.equal(reusedKey.statusCode, 409);
  assert.equal(reusedKey.json().error_code, 'IDEMPOTENCY_KEY_REUSED');

  const leaderCreated = await app.inject({ method: 'POST', url: '/api/students', headers: accountRequestHeaders(headers), payload: accountPayload({ student_number: '20260004', name: 'Ketua Baru', class_name: 'X TKJ 1', role: 'leader', username: 'ketua.baru' }) });
  assert.equal(leaderCreated.statusCode, 201);
  assert.equal(leaderCreated.json().account.role, 'leader');

  const treasurerCreated = await app.inject({ method: 'POST', url: '/api/students', headers: accountRequestHeaders(headers), payload: accountPayload({ student_number: '20260006', name: 'Bendahara Baru', class_name: 'XII AK 4', specialization: 'screenwriting', role: 'treasurer', username: 'bendahara.baru' }) });
  assert.equal(treasurerCreated.statusCode, 201);
  assert.equal(treasurerCreated.json().account.role, 'treasurer');
  assert.equal(treasurerCreated.json().data.peminatan, 'naskah');

  const listed = await app.inject({ method: 'GET', url: '/api/students?search=Budi&pageSize=10', headers });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().total, 1);
  assert.equal('foto_url' in listed.json().data[0], false);

  const id = created.json().data.id;
  const updated = await app.inject({
    method: 'PUT', url: `/api/students/${id}`, headers: { ...headers, 'x-change-reason': 'Koreksi nama siswa' },
    payload: { name: 'Budi Utama' },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().nama, 'Budi Utama');
});

test('student photo is served only through an authenticated capability-checked no-store endpoint', async (t) => {
  const state = createStudentsMemoryState();
  const studentId = '55555555-5555-4555-a555-555555555556';
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
  state.students.push({ id: studentId, nis: '20260099', nama: 'Foto Uji', kelas: 'X TKJ 1', foto_url: photo, is_active: true, created_at: new Date().toISOString() });
  const app = await createApp(state);
  t.after(() => app.close());
  const secretary = app.jwt.sign({ userId: 'secretary-1', username: 'secretary', role: 'secretary', isFirstLogin: false });
  const member = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });

  const allowed = await app.inject({ method: 'GET', url: `/api/students/${studentId}/photo`, headers: { authorization: `Bearer ${secretary}` } });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.headers['content-type'], 'image/png');
  assert.equal(allowed.headers['cache-control'], 'private, no-store');
  assert.equal(allowed.headers['x-content-type-options'], 'nosniff');
  assert.ok(allowed.rawPayload.length > 0);

  const denied = await app.inject({ method: 'GET', url: `/api/students/${studentId}/photo`, headers: { authorization: `Bearer ${member}` } });
  assert.equal(denied.statusCode, 403);
});

test('live-shaped profile photo request forwards actor and header reason, while invalid requests never mutate', async (t) => {
  const state = createStudentsMemoryState();
  const id = '66666666-6666-4666-8666-666666666666';
  const actorId = '77777777-7777-4777-8777-777777777777';
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
  state.students.push({ id, user_id: '88888888-8888-4888-8888-888888888888', nis: 'TEST-001', nama: 'Siswa Uji', kelas: 'X Uji', is_active: true, created_at: '2026-01-01T00:00:00Z' });
  const base = createStudentRepository(null, state);
  const calls: Array<Parameters<NonNullable<StudentRepository['updateProfile']>>[0]> = [];
  const repository: StudentRepository = {
    ...base,
    async updateProfile(input) { calls.push(input); return base.updateProfile!(input); },
  };
  const app = Fastify();
  t.after(() => app.close());
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(studentRoutes, {
    studentsService: new StudentService(repository, () => state.students),
    persistAuditLog: async () => undefined,
  });
  const token = app.jwt.sign({ userId: actorId, username: 'operator.fixture', role: 'secretary', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}`, 'x-change-reason': 'Ubah foto pengujian' };
  const payload = { name: 'Siswa Uji', class_name: 'X Uji', specialization: 'screenwriting', photo_url: photo };
  const response = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers, payload });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].actorId, actorId);
  assert.equal(calls[0].changeReason, 'Ubah foto pengujian');
  assert.equal(calls[0].changes.foto_url, photo);
  assert.equal(calls[0].changes.peminatan, 'naskah');

  const noReason = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers: { authorization: headers.authorization }, payload });
  assert.equal(noReason.statusCode, 422);
  const badPhoto = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers, payload: { ...payload, photo_url: 'data:image/png;base64,AAAA' } });
  assert.equal(badPhoto.statusCode, 422);
  const member = app.jwt.sign({ userId: 'member-fixture', username: 'member.fixture', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers: { ...headers, authorization: `Bearer ${member}` }, payload });
  assert.equal(denied.statusCode, 403);
  assert.equal(calls.length, 1, 'missing reason, invalid photo and unauthorized role must not mutate');
});

test('configured student list selects and returns profile metadata without photo data', async () => {
  let selectedColumns = '';
  const row = { id: 'student-1', nis: '20260001', nama: 'Rani', kelas: 'XI TKJ 1', foto_url: 'data:image/png;base64,large-image', is_active: true, created_at: '2026-01-01T00:00:00.000Z' };
  const queryBuilder = {
    select(columns: string) { selectedColumns = columns; return this; },
    or() { return this; },
    eq() { return this; },
    order() { return this; },
    range() { return this; },
    then(resolve: (value: { data: typeof row[]; count: number; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: [row], count: 1, error: null }).then(resolve, reject);
    },
  };
  const repository = createStudentRepository({ from: () => queryBuilder } as never);

  const result = await repository.list?.({ page: 1, pageSize: 20 });

  if (!result || !('data' in result) || !result.data) throw new Error('Expected configured student list data');
  assert.equal(selectedColumns.includes('foto_url'), false);
  assert.equal('foto_url' in result.data.data[0], false);
});

test('new student account requires a manual username, WhatsApp number, and idempotency key', async (t) => {
  const state = createStudentsMemoryState();
  const app = await createApp(state);
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'secretary-1', username: 'secretary', role: 'secretary', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };
  const basePayload = { student_number: '20260190', name: 'Rani Putri', class_name: 'X TKJ 1', username: 'rani', phone_number: '081234567890' };

  const missingKey = await app.inject({ method: 'POST', url: '/api/students', headers, payload: basePayload });
  assert.equal(missingKey.statusCode, 400);
  const missingPhone = await app.inject({
    method: 'POST', url: '/api/students', headers: accountRequestHeaders(headers),
    payload: { ...basePayload, student_number: '20260191', phone_number: undefined },
  });
  assert.equal(missingPhone.statusCode, 400);

  const created = await app.inject({
    method: 'POST', url: '/api/students', headers: accountRequestHeaders(headers), payload: basePayload,
  });
  assert.equal(created.statusCode, 201);
  const duplicateUsername = await app.inject({
    method: 'POST', url: '/api/students', headers: accountRequestHeaders(headers),
    payload: { ...basePayload, student_number: '20260192', username: 'RANI' },
  });
  assert.equal(duplicateUsername.statusCode, 409);
  assert.equal(duplicateUsername.json().error_code, 'USERNAME_TAKEN');
  assert.equal(state.students.length, 1);
});

test('student status changes require teacher capability and options stay bounded', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const secretaryToken = app.jwt.sign({ userId: 'secretary-1', username: 'secretary', role: 'secretary', isFirstLogin: false });
  const teacherToken = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const secretaryHeaders = { authorization: `Bearer ${secretaryToken}` };
  const teacherHeaders = { authorization: `Bearer ${teacherToken}` };
  const created = await app.inject({ method: 'POST', url: '/api/students', headers: accountRequestHeaders(secretaryHeaders), payload: accountPayload({ student_number: '20260002', name: 'Sari', class_name: 'XI AK 1' }) });
  const id = created.json().data.id;
  const denied = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers: { ...secretaryHeaders, 'x-change-reason': 'Jadikan alumni' }, payload: { is_active: false } });
  assert.equal(denied.statusCode, 403);
  const deactivated = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers: { ...teacherHeaders, 'x-change-reason': 'Jadikan alumni' }, payload: { is_active: false } });
  assert.equal(deactivated.statusCode, 200);

  const options = await app.inject({ method: 'GET', url: '/api/students/options?limit=100', headers: teacherHeaders });
  assert.equal(options.statusCode, 200);
  assert.equal(options.json().data.length, 0);
});

test('teacher can purge only an inactive student through the atomic boundary', async (t) => {
  const state = createStudentsMemoryState();
  const studentId = '55555555-5555-4555-a555-555555555555';
  const accountId = '33333333-3333-4333-a333-333333333333';
  state.students.push({
    id: studentId,
    user_id: accountId,
    nis: '20260030',
    nama: 'Data Uji',
    kelas: 'XI AK 1',
    is_active: false,
    created_at: new Date().toISOString(),
  });
  state.accounts.push({ id: accountId, username: 'siswa_uji', nama: 'Data Uji', role: 'member', is_active: false, is_first_login: false });
  const app = await createApp(state);
  t.after(() => app.close());
  const teacher = app.jwt.sign({ userId: 'teacher-1', username: 'guru', role: 'teacher', isFirstLogin: false });

  const purged = await app.inject({
    method: 'DELETE',
    url: `/api/students/${studentId}`,
    headers: { authorization: `Bearer ${teacher}`, 'x-change-reason': 'Menghapus data uji nonaktif' },
    payload: {},
  });
  assert.equal(purged.statusCode, 204);
  assert.equal(state.students.length, 0);
  assert.equal(state.accounts.length, 0);
});

test('cash managers can use the minimal student selector without student administration access', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const secretaryToken = app.jwt.sign({ userId: 'secretary-1', username: 'secretary', role: 'secretary', isFirstLogin: false });
  const treasurerToken = app.jwt.sign({ userId: 'treasurer-1', username: 'treasurer', role: 'treasurer', isFirstLogin: false });
  const secretaryHeaders = { authorization: `Bearer ${secretaryToken}` };
  const treasurerHeaders = { authorization: `Bearer ${treasurerToken}` };
  await app.inject({
    method: 'POST',
    url: '/api/students',
    headers: accountRequestHeaders(secretaryHeaders),
    payload: accountPayload({ student_number: '20260003', name: 'Maya', class_name: 'XI AK 1' }),
  });

  const options = await app.inject({
    method: 'GET',
    url: '/api/students/options?q=Maya',
    headers: treasurerHeaders,
  });
  assert.equal(options.statusCode, 200);
  assert.equal(options.json().data[0].nama, 'Maya');
  assert.deepEqual(Object.keys(options.json().data[0]).sort(), ['id', 'kelas', 'label', 'nama', 'nis', 'secondaryLabel']);

  const fullStudentList = await app.inject({ method: 'GET', url: '/api/students', headers: treasurerHeaders });
  assert.equal(fullStudentList.statusCode, 403);
});

test('a borrowing-only manager cannot retrieve full student records', async (t) => {
  const previous = getCapabilities('equipment_team');
  setRoleCapabilities('equipment_team', ['borrowing.manage']);
  const app = await createApp();
  t.after(async () => { setRoleCapabilities('equipment_team', previous); await app.close(); });
  const token = app.jwt.sign({ userId: 'tools-1', username: 'alat', role: 'equipment_team', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };
  const full = await app.inject({ method: 'GET', url: '/api/students', headers });
  assert.equal(full.statusCode, 403);
  const options = await app.inject({ method: 'GET', url: '/api/students/options', headers });
  assert.equal(options.statusCode, 200);
});

test('teacher can explicitly link an eligible legacy account without changing its credentials', async (t) => {
  const state = createStudentsMemoryState();
  const accountId = '33333333-3333-4333-a333-333333333333';
  const teacherId = 'teacher-1';
  state.accounts.push({
    id: accountId,
    username: 'ketua',
    nama: 'Ketua Ekstra',
    role: 'leader',
    is_active: true,
    is_first_login: false,
  });
  const app = await createApp(state);
  t.after(() => app.close());
  const teacherToken = app.jwt.sign({ userId: teacherId, username: 'guru', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${teacherToken}` };

  const candidates = await app.inject({ method: 'GET', url: '/api/students/unlinked-accounts?q=ketua', headers });
  assert.equal(candidates.statusCode, 200);
  assert.deepEqual(candidates.json().data, [{ id: accountId, username: 'ketua', nama: 'Ketua Ekstra', role: 'leader' }]);

  const linked = await app.inject({
    method: 'POST',
    url: '/api/students/account-links',
    headers: { ...headers, 'x-change-reason': 'Tautkan akun ketua siswa lama' },
    payload: { user_id: accountId, student_number: '20260005', name: 'Ketua Ekstra', class_name: 'XI AK 1', change_reason: 'Tautkan akun ketua siswa lama' },
  });
  assert.equal(linked.statusCode, 201);
  assert.equal(linked.json().account.user_id, accountId);
  assert.equal(linked.json().account.role, 'leader');
  assert.equal('temporary_password' in linked.json().account, false);
  assert.equal(linked.json().data.user_id, accountId);
  assert.equal(state.accounts[0].is_first_login, false);
  assert.equal(state.accounts[0].username, 'ketua');

  const candidatesAfterLink = await app.inject({ method: 'GET', url: '/api/students/unlinked-accounts', headers });
  assert.deepEqual(candidatesAfterLink.json().data, []);
});

test('teacher can attach an eligible account to an existing unlinked student profile', async (t) => {
  const state = createStudentsMemoryState();
  const accountId = '33333333-3333-4333-a333-333333333333';
  const studentId = '55555555-5555-4555-a555-555555555555';
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
  const app = await createApp(state);
  t.after(() => app.close());
  const teacherToken = app.jwt.sign({ userId: 'teacher-1', username: 'guru', role: 'teacher', isFirstLogin: false });
  const linked = await app.inject({
    method: 'POST',
    url: `/api/students/${studentId}/account-links`,
    headers: { authorization: `Bearer ${teacherToken}` },
    payload: { user_id: accountId, change_reason: 'Tautkan akun ke profil siswa lama' },
  });

  assert.equal(linked.statusCode, 200);
  assert.equal(linked.json().data.id, studentId);
  assert.equal(linked.json().data.user_id, accountId);
  assert.equal(linked.json().account.username, 'ketua');
  assert.equal(linked.json().account.role, 'leader');
  assert.equal('temporary_password' in linked.json().account, false);
  assert.equal(state.students.length, 1);
});

test('student-role accounts cannot access the legacy account linking flow', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const leaderToken = app.jwt.sign({ userId: 'leader-1', username: 'ketua', role: 'leader', isFirstLogin: false });
  const denied = await app.inject({
    method: 'GET',
    url: '/api/students/unlinked-accounts',
    headers: { authorization: `Bearer ${leaderToken}` },
  });
  assert.equal(denied.statusCode, 403);
});
