import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createEquipmentMemoryState } from './equipment.helpers.js';
import { createEquipmentRepository } from './equipment.repository.js';
import { createEquipmentRecoveryMemoryState } from './equipment.recovery.helpers.js';
import { createEquipmentRecoveryRepository } from './equipment.recovery.repository.js';
import { EquipmentRecoveryService } from './equipment.recovery.service.js';
import { EquipmentService } from './equipment.service.js';
import equipmentRoutes from './equipment.routes.js';
const pngPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';

async function createApp(state = createEquipmentMemoryState()) {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(equipmentRoutes, {
    equipmentService: new EquipmentService(createEquipmentRepository(null, state)),
    equipmentRecoveryService: new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, createEquipmentRecoveryMemoryState(), state)),
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
  assert.equal('foto_urls' in response.json().data[0], false);
  assert.equal('foto_url' in response.json().data[0], false);

  const report = await app.inject({
    method: 'GET',
    url: '/api/equipment/report?scope=all&include_valuation=true',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
  });
  assert.equal(report.statusCode, 200);
  assert.equal(report.json().success, true);
  assert.equal(report.json().data.meta.filters.scope, 'all');
  assert.equal(report.json().data.items[0].equipment_code, 'AUD-001');

  const deniedReport = await app.inject({
    method: 'GET',
    url: '/api/equipment/report',
    headers: { authorization: `Bearer ${token(app, 'member')}` },
  });
  assert.equal(deniedReport.statusCode, 403);
});

test('equipment photo endpoint checks capability and never enables shared browser caching', async (t) => {
  const state = createEquipmentMemoryState();
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
  state.equipment[0].foto_url = photo;
  const app = await createApp(state);
  t.after(() => app.close());

  const allowed = await app.inject({ method: 'GET', url: '/api/equipment/eq-001/photo', headers: { authorization: `Bearer ${token(app, 'equipment_team')}` } });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.headers['content-type'], 'image/png');
  assert.equal(allowed.headers['cache-control'], 'private, no-store');
  assert.equal(allowed.headers['x-content-type-options'], 'nosniff');

  const denied = await app.inject({ method: 'GET', url: '/api/equipment/eq-001/photo', headers: { authorization: `Bearer ${token(app, 'member')}` } });
  assert.equal(denied.statusCode, 403);
});

test('configured equipment list omits photo columns from its query and response', async () => {
  const selectedColumns: string[] = [];
  const row = {
    id: 'equipment-1', kode_alat: 'CAM-001', nama_alat: 'Kamera', kategori: 'Kamera', kondisi: 'bagus', status: 'tersedia',
    fotos: ['data:image/jpeg;base64,large-photo'], foto_url: 'data:image/jpeg;base64,legacy-photo', created_at: '2026-01-01T00:00:00.000Z',
  };
  const queryBuilder = {
    select(columns: string) { selectedColumns.push(columns); return this; },
    eq() { return this; },
    in() { return this; },
    order() { return this; },
    range() { return this; },
    limit() { return this; },
    then(resolve: (value: { data: typeof row[]; count: number; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: selectedColumns.length === 1 ? [row] : [], count: 1, error: null }).then(resolve, reject);
    },
  };
  const repository = createEquipmentRepository({ from: () => queryBuilder } as never, createEquipmentMemoryState());

  const result = await repository.list({ page: 1, pageSize: 20 });

  assert.equal(selectedColumns[0]?.includes('fotos'), false);
  assert.equal(selectedColumns[0]?.includes('foto_url'), false);
  assert.equal('foto_urls' in result.data[0], false);
  assert.equal('foto_url' in result.data[0], false);
});

test('borrowing request roles can only see sanitized available equipment', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/equipment?status=available&page=1&pageSize=10',
    headers: { authorization: `Bearer ${token(app, 'secretary')}` },
  });
  assert.equal(response.statusCode, 200);
  const first = response.json().data[0];
  assert.equal(first.status, 'tersedia');
  assert.equal(first.lokasi_penyimpanan, undefined);
  assert.equal(first.serial_number, undefined);
  assert.equal(first.foto_urls, undefined);

  const forbidden = await app.inject({
    method: 'GET',
    url: '/api/equipment?status=maintenance',
    headers: { authorization: `Bearer ${token(app, 'secretary')}` },
  });
  assert.equal(forbidden.statusCode, 403);

  const equipmentTeamBorrowingOptions = await app.inject({
    method: 'GET',
    url: '/api/equipment?purpose=borrowing_request&status=available&page=1&pageSize=10',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
  });
  assert.equal(equipmentTeamBorrowingOptions.statusCode, 200);
  const equipmentTeamItem = equipmentTeamBorrowingOptions.json().data[0];
  assert.equal(equipmentTeamItem.lokasi_penyimpanan, undefined);
  assert.equal(equipmentTeamItem.serial_number, undefined);
  assert.equal(equipmentTeamItem.foto_urls, undefined);

  const invalidPurpose = await app.inject({
    method: 'GET',
    url: '/api/equipment?purpose=borrowing_request',
    headers: { authorization: `Bearer ${token(app, 'member')}` },
  });
  assert.equal(invalidPurpose.statusCode, 403);
});

test('equipment mutation routes keep the equipment-team role guard and validate schemas', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const denied = await app.inject({
    method: 'POST',
    url: '/api/equipment',
    headers: { authorization: `Bearer ${token(app, 'member')}` },
    payload: {
      equipment_code: 'CAM-DENIED', name: 'Kamera Ditolak', category: 'camera', condition: 'good', status: 'available',
      photo_urls: [pngPhoto, pngPhoto, pngPhoto],
    },
  });
  assert.equal(denied.statusCode, 403);

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/equipment',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
    payload: {
      equipment_code: 'CAM-NEW', name: 'Kamera Baru', category: 'camera', condition: 'good', status: 'available',
      photo_urls: ['ftp://example.test/one.jpg', 'ftp://example.test/two.jpg', 'ftp://example.test/three.jpg'],
    },
  });
  assert.equal(invalid.statusCode, 422);
});

test('recovery routes keep capability guards and require final inspection confirmation', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const activeCases = await app.inject({
    method: 'GET',
    url: '/api/equipment/recovery-cases?status=active',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
  });
  assert.equal(activeCases.statusCode, 200);
  assert.deepEqual(activeCases.json().data, []);

  const historyCases = await app.inject({
    method: 'GET',
    url: '/api/equipment/recovery-cases?status=history',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
  });
  assert.equal(historyCases.statusCode, 200);
  assert.deepEqual(historyCases.json().data, []);

  const denied = await app.inject({
    method: 'POST',
    url: '/api/equipment/eq-001/recovery-cases',
    headers: { authorization: `Bearer ${token(app, 'member')}` },
    payload: { recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' },
  });
  assert.equal(denied.statusCode, 403);

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/equipment/recovery-cases/case-1/complete-repair',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
    payload: { inspection_photos: [pngPhoto, pngPhoto], change_reason: 'Verifikasi hasil servis' },
  });
  assert.equal(invalid.statusCode, 400);

  const invalidPayment = await app.inject({
    method: 'POST',
    url: '/api/equipment/charges/charge-1/payments',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
    payload: { payment_amount: 1000, evidence_ids: [], change_reason: 'Catat pembayaran' },
  });
  assert.equal(invalidPayment.statusCode, 400);

  const legacyPayment = await app.inject({
    method: 'PATCH',
    url: '/api/equipment/charges/charge-1',
    headers: { authorization: `Bearer ${token(app, 'equipment_team')}` },
    payload: { paid_amount: 1000, status: 'paid', change_reason: 'Pembayaran lama' },
  });
  assert.equal(legacyPayment.statusCode, 410);
  assert.equal(legacyPayment.json().error_code, 'CHARGE_PAYMENT_LEGACY_DISABLED');
});
