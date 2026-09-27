import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createStudentsMemoryState } from './students.helpers.js';
import { createStudentRepository } from './students.repository.js';
import { StudentService } from './students.service.js';
import studentRoutes from './students.routes.js';

async function createApp(state = createStudentsMemoryState()) {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(studentRoutes, {
    studentsService: new StudentService(createStudentRepository(null, state), () => state.students),
    persistAuditLog: async () => undefined,
  });
  return app;
}

test('student management keeps secretary guard and account response contract', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const memberToken = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'GET', url: '/api/students', headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(denied.statusCode, 403);

  const secretaryToken = app.jwt.sign({ userId: 'secretary-1', username: 'secretary', role: 'secretary', isFirstLogin: false });
  const headers = { authorization: `Bearer ${secretaryToken}` };
  const created = await app.inject({ method: 'POST', url: '/api/students', headers, payload: { student_number: '20260001', name: 'Budi Santoso', class_name: 'X TKJ 1', specialization: 'kamera' } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().success, true);
  assert.equal(created.json().account.role, 'member');
  assert.equal(typeof created.json().account.temporary_password, 'string');

  const leaderCreated = await app.inject({ method: 'POST', url: '/api/students', headers, payload: { student_number: '20260004', name: 'Ketua Baru', class_name: 'X TKJ 1', role: 'leader' } });
  assert.equal(leaderCreated.statusCode, 201);
  assert.equal(leaderCreated.json().account.role, 'leader');

  const treasurerCreated = await app.inject({ method: 'POST', url: '/api/students', headers, payload: { student_number: '20260006', name: 'Bendahara Baru', class_name: 'XII AK 4', specialization: 'screenwriting', role: 'treasurer' } });
  assert.equal(treasurerCreated.statusCode, 201);
  assert.equal(treasurerCreated.json().account.role, 'treasurer');
  assert.equal(treasurerCreated.json().data.peminatan, 'naskah');

  const listed = await app.inject({ method: 'GET', url: '/api/students?search=Budi&pageSize=10', headers });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().total, 1);

  const id = created.json().data.id;
  const updated = await app.inject({
    method: 'PUT', url: `/api/students/${id}`, headers: { ...headers, 'x-change-reason': 'Koreksi nama siswa' },
    payload: { name: 'Budi Utama' },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().nama, 'Budi Utama');
});

test('student status changes require teacher capability and options stay bounded', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const secretaryToken = app.jwt.sign({ userId: 'secretary-1', username: 'secretary', role: 'secretary', isFirstLogin: false });
  const teacherToken = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const secretaryHeaders = { authorization: `Bearer ${secretaryToken}` };
  const teacherHeaders = { authorization: `Bearer ${teacherToken}` };
  const created = await app.inject({ method: 'POST', url: '/api/students', headers: secretaryHeaders, payload: { student_number: '20260002', name: 'Sari', class_name: 'XI AK 1' } });
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
    headers: secretaryHeaders,
    payload: { student_number: '20260003', name: 'Maya', class_name: 'XI AK 1' },
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
