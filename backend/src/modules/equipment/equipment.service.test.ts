import assert from 'node:assert/strict';
import test from 'node:test';
import { createEquipmentMemoryState } from './equipment.helpers.js';
import { createEquipmentRepository } from './equipment.repository.js';
import { EquipmentService, EquipmentServiceError } from './equipment.service.js';

function service() {
  const state = createEquipmentMemoryState();
  return { service: new EquipmentService(createEquipmentRepository(null, state)), state };
}

const validPhotos = [
  'https://example.test/equipment/front.jpg',
  'https://example.test/equipment/back.jpg',
  'https://example.test/equipment/side.jpg',
];

test('equipment service keeps list pagination bounded and summary count-only in memory', async () => {
  const { service: equipmentService } = service();
  const list = await equipmentService.list({ page: 0, pageSize: 1000 });
  assert.equal(list.page, 1);
  assert.equal(list.pageSize, 100);
  assert.equal(list.total, 3);

  const summary = await equipmentService.summary();
  assert.deepEqual(summary, { totalAlat: 3, tersedia: 2, dipinjam: 1, maintenance: 0, rusak: 0 });
});

test('equipment service rejects incomplete or invalid photo payloads before persistence', async () => {
  const { service: equipmentService } = service();
  await assert.rejects(
    equipmentService.create({
      kode_alat: 'CAM-NEW', nama_alat: 'Kamera Baru', kategori: 'Kamera', kondisi: 'bagus', status: 'tersedia', foto_urls: validPhotos.slice(0, 2),
    }, 'user-1'),
    (error: unknown) => error instanceof EquipmentServiceError && error.statusCode === 422,
  );

  const created = await equipmentService.create({
    kode_alat: 'CAM-DEFAULT', nama_alat: 'Kamera Default', foto_urls: validPhotos,
  }, 'user-1');
  assert.equal(created.kategori, 'Kamera');
  assert.equal(created.kondisi, 'bagus');
  assert.equal(created.status, 'tersedia');
});

test('equipment service updates condition notes and removes only existing records', async () => {
  const { service: equipmentService, state } = service();
  const updated = await equipmentService.updateCondition('eq-001', {
    kondisi: 'rusak',
    status: 'maintenance',
    catatan_kerusakan: 'Layar retak setelah pemeriksaan.',
  }, 'user-1');
  assert.equal(updated.kondisi, 'rusak');
  assert.equal(updated.status, 'maintenance');
  assert.equal(updated.catatan_kerusakan, 'Layar retak setelah pemeriksaan.');

  await equipmentService.remove('eq-002');
  assert.equal(state.equipment.some((item) => item.id === 'eq-002'), false);
  await assert.rejects(
    equipmentService.remove('missing'),
    (error: unknown) => error instanceof EquipmentServiceError && error.statusCode === 404,
  );
});
