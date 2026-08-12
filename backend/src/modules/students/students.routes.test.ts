import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createStudentsMemoryState } from './students.helpers.js';
import { createStudentRepository } from './students.repository.js';
import { StudentService } from './students.service.js';
import studentRoutes from './students.routes.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const state = createStudentsMemoryState();
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
  const created = await app.inject({ method: 'POST', url: '/api/students', headers, payload: { nis: '20260001', nama: 'Budi Santoso', kelas: 'X TKJ 1', peminatan: 'kamera' } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().success, true);
  assert.equal(created.json().account.role, 'member');
  assert.equal(typeof created.json().account.temporary_password, 'string');

  const listed = await app.inject({ method: 'GET', url: '/api/students?search=Budi&pageSize=10', headers });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().total, 1);

  const id = created.json().data.id;
  const updated = await app.inject({
    method: 'PUT', url: `/api/students/${id}`, headers: { ...headers, 'x-change-reason': 'Koreksi nama siswa' },
    payload: { nama: 'Budi Utama' },
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
  const created = await app.inject({ method: 'POST', url: '/api/students', headers: secretaryHeaders, payload: { nis: '20260002', nama: 'Sari', kelas: 'XI AK 1' } });
  const id = created.json().data.id;
  const denied = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers: { ...secretaryHeaders, 'x-change-reason': 'Jadikan alumni' }, payload: { is_active: false } });
  assert.equal(denied.statusCode, 403);
  const deactivated = await app.inject({ method: 'PUT', url: `/api/students/${id}`, headers: { ...teacherHeaders, 'x-change-reason': 'Jadikan alumni' }, payload: { is_active: false } });
  assert.equal(deactivated.statusCode, 200);

  const options = await app.inject({ method: 'GET', url: '/api/students/options?limit=100', headers: teacherHeaders });
  assert.equal(options.statusCode, 200);
  assert.equal(options.json().data.length, 0);
});
