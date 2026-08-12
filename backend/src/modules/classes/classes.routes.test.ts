import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createClassesMemoryState } from './classes.helpers.js';
import { createClassesRepository } from './classes.repository.js';
import { ClassesService } from './classes.service.js';
import classesRoutes from './classes.routes.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(classesRoutes, {
    classesService: new ClassesService(createClassesRepository(null, createClassesMemoryState())),
    persistAuditLog: async () => undefined,
  });
  return app;
}

test('class options remain public while admin list requires teacher role', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const options = await app.inject({ method: 'GET', url: '/api/options/kelas' });
  assert.equal(options.statusCode, 200);
  assert.equal(options.json().success, true);
  assert.equal(options.json().data.length, 45);
  assert.deepEqual(Object.keys(options.json().data[0]).sort(), ['id', 'nama_kelas', 'tingkat']);

  const memberToken = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const denied = await app.inject({ method: 'GET', url: '/api/admin/classes', headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(denied.statusCode, 403);
});

test('class admin routes preserve create/update/deactivate envelopes', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };
  const created = await app.inject({
    method: 'POST', url: '/api/admin/classes', headers,
    payload: { nama_kelas: 'X Film 1', tingkat: 'X' },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().success, true);
  const id = created.json().data.id;

  const updated = await app.inject({
    method: 'PUT', url: `/api/admin/classes/${id}`,
    headers: { ...headers, 'x-change-reason': 'Koreksi nama kelas' },
    payload: { nama_kelas: 'X Film Utama 1' },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().data.nama_kelas, 'X Film Utama 1');

  const deactivated = await app.inject({
    method: 'DELETE', url: `/api/admin/classes/${id}`,
    headers: { ...headers, 'x-change-reason': 'Menonaktifkan kelas lama' },
  });
  assert.equal(deactivated.statusCode, 200);
  assert.equal(deactivated.json().success, true);
});
