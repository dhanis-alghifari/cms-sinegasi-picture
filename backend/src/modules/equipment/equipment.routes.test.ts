import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createEquipmentMemoryState } from './equipment.helpers.js';
import { createEquipmentRepository } from './equipment.repository.js';
import { EquipmentService } from './equipment.service.js';
import equipmentRoutes from './equipment.routes.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const state = createEquipmentMemoryState();
  await app.register(equipmentRoutes, {
    equipmentService: new EquipmentService(createEquipmentRepository(null, state)),
    persistAuditLog: async () => undefined,
  });
  return app;
}

function token(app: FastifyInstance, role: string) {
  return app.jwt.sign({ userId: `${role}-1`, username: role, role, isFirstLogin: false });
}

test('equipment routes require authentication and preserve the list envelope', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const unauthorized = await app.inject({ method: 'GET', url: '/api/equipment' });
  assert.equal(unauthorized.statusCode, 401);

  const response = await app.inject({
    method: 'GET',
    url: '/api/equipment?page=1&pageSize=2',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.equal(response.json().pageSize, 2);
  assert.equal(response.json().data.length, 2);
});

test('equipment mutation routes keep the equipment-team role guard and validate schemas', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const denied = await app.inject({
    method: 'POST',
    url: '/api/equipment',
    headers: { authorization: `Bearer ${token(app, 'member')}` },
    payload: {
      kode_alat: 'CAM-DENIED', nama_alat: 'Kamera Ditolak', kategori: 'Kamera', kondisi: 'bagus', status: 'tersedia',
      foto_urls: ['https://example.test/one.jpg', 'https://example.test/two.jpg', 'https://example.test/three.jpg'],
    },
  });
  assert.equal(denied.statusCode, 403);

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/equipment',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
    payload: {
      kode_alat: 'CAM-NEW', nama_alat: 'Kamera Baru', kategori: 'Kamera', kondisi: 'bagus', status: 'tersedia',
      foto_urls: ['ftp://example.test/one.jpg', 'ftp://example.test/two.jpg', 'ftp://example.test/three.jpg'],
    },
  });
  assert.equal(invalid.statusCode, 422);
});
