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
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=',
];

test('equipment service keeps list pagination bounded and summary count-only in memory', async () => {
  const { service: equipmentService } = service();
  const list = await equipmentService.list({ page: 0, pageSize: 1000 });
  assert.equal(list.page, 1);
  assert.equal(list.pageSize, 100);
  assert.equal(list.total, 3);

  const summary = await equipmentService.summary();
  assert.deepEqual(summary, { totalAlat: 3, tersedia: 2, dipinjam: 1, maintenance: 0, rusak: 1, hilang: 0 });
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

test('equipment report returns English API fields and separates attention items', async () => {
  const { service: equipmentService } = service();
  const report = await equipmentService.report({ scope: 'all', includeValuation: true });
  assert.equal(report.meta.report_version, 1);
  assert.equal(report.meta.filters.scope, 'all');
  assert.equal(report.summary.total_units, 3);
  assert.equal(report.summary.available_units, 2);
  assert.equal(report.summary.borrowed_units, 1);
  assert.equal(report.summary.damaged_units, 1);
  assert.equal(report.summary.attention_units, 3);
  assert.equal(report.items[0].equipment_code, 'AUD-001');
  assert.equal('kode_alat' in report.items[0], false);
  assert.equal(report.attention_items.some((item) => item.attention_reasons.includes('missing_valuation')), true);
});

test('equipment service updates condition notes and removes only existing records', async () => {
  const { service: equipmentService, state } = service();
  const updated = await equipmentService.updateCondition('eq-001', {
    kondisi: 'rusak',
    status: 'maintenance',
    catatan_kerusakan: 'Layar retak setelah pemeriksaan.',
  }, 'user-1', 'Memperbarui kondisi alat');
  assert.equal(updated.kondisi, 'rusak');
  assert.equal(updated.status, 'maintenance');
  assert.equal(updated.catatan_kerusakan, 'Layar retak setelah pemeriksaan.');

  await equipmentService.remove('eq-002', 'user-1', 'Menghapus alat yang tidak digunakan');
  assert.equal(state.equipment.some((item) => item.id === 'eq-002'), false);
  await assert.rejects(
    equipmentService.remove('missing', 'user-1', 'Menghapus alat yang tidak ditemukan'),
    (error: unknown) => error instanceof EquipmentServiceError && error.statusCode === 404,
  );
});

test('equipment service rejects impossible condition and availability combinations', async () => {
  const { service: equipmentService, state } = service();
  await assert.rejects(
    equipmentService.create({
      kode_alat: 'CAM-INVALID', nama_alat: 'Kamera Invalid', kategori: 'Kamera', kondisi: 'rusak', status: 'tersedia', foto_urls: validPhotos,
    }, 'user-1'),
    (error: unknown) => error instanceof EquipmentServiceError && error.errorCode === 'INVALID_EQUIPMENT_STATE' && error.statusCode === 422,
  );
  await assert.rejects(
    equipmentService.updateCondition('eq-001', { kondisi: 'hilang', status: 'tersedia', catatan_kerusakan: 'Tidak ditemukan.' }, 'user-1', 'Menandai alat hilang'),
    (error: unknown) => error instanceof EquipmentServiceError && error.errorCode === 'INVALID_EQUIPMENT_STATE' && error.statusCode === 422,
  );
  assert.equal(state.equipment.find((item) => item.id === 'eq-001')?.status, 'tersedia');
});
