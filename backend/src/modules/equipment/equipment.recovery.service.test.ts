import assert from 'node:assert/strict';
import test from 'node:test';
import { createEquipmentMemoryState } from './equipment.helpers.js';
import { createEquipmentRecoveryMemoryState } from './equipment.recovery.helpers.js';
import { createEquipmentRecoveryRepository } from './equipment.recovery.repository.js';
import { EquipmentRecoveryService, EquipmentRecoveryServiceError } from './equipment.recovery.service.js';

const actorId = 'actor-1';
const evidenceStorage = {
  createUpload: (fileName: string, folder: string) => ({ uploadUrl: 'https://upload.example.test/signed', key: `${folder}/${fileName}`, expiresInSeconds: 900 }),
  verifyUpload: async () => true,
  createAccess: () => ({ accessUrl: 'https://download.example.test/signed', expiresInSeconds: 900 }),
};
const baseEquipment = (id: string, condition: 'rusak' | 'hilang') => ({
  id, kode_alat: `${id}-001`, nama_alat: 'Camera', kategori: 'Kamera' as const, kondisi: condition, status: 'maintenance' as const,
  asset_state: condition === 'hilang' ? 'lost' as const : 'active' as const, foto_urls: [], created_at: new Date().toISOString(),
});

test('recovery service opens and completes a repair in memory', async () => {
  const equipmentState = createEquipmentMemoryState(); equipmentState.equipment.push(baseEquipment('eq-1', 'rusak'));
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, createEquipmentRecoveryMemoryState(), equipmentState));
  const item = await service.createCase({ equipment_id: 'eq-1', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  const equipment = await service.completeRepair({ case_id: item.id, inspection_photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'], inspection_passed: true, change_reason: 'Verifikasi hasil servis' }, actorId);
  assert.equal(equipment.status, 'tersedia'); assert.equal(equipment.kondisi, 'bagus');
});

test('recovery service requires the final inspection checklist', async () => {
  const equipmentState = createEquipmentMemoryState(); equipmentState.equipment.push(baseEquipment('eq-3', 'rusak'));
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, createEquipmentRecoveryMemoryState(), equipmentState));
  const item = await service.createCase({ equipment_id: 'eq-3', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  await assert.rejects(
    service.completeRepair({ case_id: item.id, inspection_photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'], inspection_passed: false, change_reason: 'Verifikasi hasil servis' }, actorId),
    (error: unknown) => error instanceof Error && error.message.includes('Checklist pemeriksaan akhir'),
  );
});

test('repair and replacement reject invalid photos before changing inventory', async () => {
  const equipmentState = createEquipmentMemoryState();
  equipmentState.equipment.push(baseEquipment('eq-invalid-repair', 'rusak'), baseEquipment('eq-invalid-replacement', 'hilang'));
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, createEquipmentRecoveryMemoryState(), equipmentState));
  const repair = await service.createCase({ equipment_id: 'eq-invalid-repair', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  const replacement = await service.createCase({ equipment_id: 'eq-invalid-replacement', recovery_type: 'replacement', reported_condition: 'lost', change_reason: 'Membuka kasus penggantian' }, actorId);
  const invalidPhoto = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  await assert.rejects(
    service.completeRepair({ case_id: repair.id, inspection_photos: [invalidPhoto, 'https://example.test/back.jpg'], inspection_passed: true, change_reason: 'Verifikasi hasil servis' }, actorId),
    (error: unknown) => error instanceof EquipmentRecoveryServiceError && error.errorCode === 'RECOVERY_EVIDENCE_INVALID',
  );
  await assert.rejects(
    service.registerReplacement({ case_id: replacement.id, equipment_code: 'CAM-INVALID', name: 'Camera Baru', category: 'camera', photo_urls: [invalidPhoto, 'https://example.test/back.jpg', 'https://example.test/side.jpg'], change_reason: 'Mendaftarkan unit pengganti' }, actorId),
    (error: unknown) => error instanceof EquipmentRecoveryServiceError && error.errorCode === 'RECOVERY_EVIDENCE_INVALID',
  );
  assert.equal(equipmentState.equipment.length, 2);
  assert.equal(equipmentState.equipment[0]?.status, 'maintenance');
  assert.equal(equipmentState.equipment[1]?.asset_state, 'lost');
});

test('recovery service active filter includes every unfinished status', async () => {
  const equipmentState = createEquipmentMemoryState();
  equipmentState.equipment.push(baseEquipment('eq-open', 'rusak'), baseEquipment('eq-progress', 'rusak'));
  const recoveryState = createEquipmentRecoveryMemoryState();
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, recoveryState, equipmentState), evidenceStorage);
  const openCase = await service.createCase({ equipment_id: 'eq-open', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  const progressCase = await service.createCase({ equipment_id: 'eq-progress', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  const progress = recoveryState.cases.find((item) => item.id === progressCase.id);
  if (progress) progress.status = 'in_progress';

  const activeCases = await service.listCases({ status: 'active' });
  assert.deepEqual(new Set(activeCases.map((item) => item.id)), new Set([openCase.id, progressCase.id]));
});

test('recovery service history filter includes completed, unrepairable, and cancelled cases', async () => {
  const equipmentState = createEquipmentMemoryState();
  equipmentState.equipment.push(
    baseEquipment('eq-completed', 'rusak'),
    baseEquipment('eq-unrepairable', 'rusak'),
    baseEquipment('eq-cancelled', 'rusak'),
    baseEquipment('eq-open-history', 'rusak'),
  );
  const recoveryState = createEquipmentRecoveryMemoryState();
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, recoveryState, equipmentState), evidenceStorage);
  const completedCase = await service.createCase({ equipment_id: 'eq-completed', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  const unrepairableCase = await service.createCase({ equipment_id: 'eq-unrepairable', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  const cancelledCase = await service.createCase({ equipment_id: 'eq-cancelled', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  await service.createCase({ equipment_id: 'eq-open-history', recovery_type: 'repair', reported_condition: 'damaged', change_reason: 'Membuka kasus servis' }, actorId);
  recoveryState.cases.find((item) => item.id === completedCase.id)!.status = 'completed';
  recoveryState.cases.find((item) => item.id === unrepairableCase.id)!.status = 'unrepairable';
  recoveryState.cases.find((item) => item.id === cancelledCase.id)!.status = 'cancelled';

  const historyCases = await service.listCases({ status: 'history' });
  assert.deepEqual(new Set(historyCases.map((item) => item.id)), new Set([completedCase.id, unrepairableCase.id, cancelledCase.id]));
});

test('replacement registration creates a new available unit and retires the old unit', async () => {
  const equipmentState = createEquipmentMemoryState(); equipmentState.equipment.push(baseEquipment('eq-2', 'hilang'));
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, createEquipmentRecoveryMemoryState(), equipmentState));
  const item = await service.createCase({ equipment_id: 'eq-2', recovery_type: 'replacement', reported_condition: 'lost', change_reason: 'Membuka kasus penggantian' }, actorId);
  const replacement = await service.registerReplacement({ case_id: item.id, equipment_code: 'CAM-NEW', name: 'Camera Baru', category: 'camera', photo_urls: ['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'], change_reason: 'Mendaftarkan unit pengganti' }, actorId);
  assert.equal(replacement.status, 'tersedia'); assert.equal(equipmentState.equipment.find((equipment) => equipment.id === 'eq-2')?.asset_state, 'lost');
});

test('charge payment events attach evidence and update only the remaining balance', async () => {
  const equipmentState = createEquipmentMemoryState();
  const recoveryState = createEquipmentRecoveryMemoryState();
  recoveryState.charges.push({
    id: 'charge-1', assessment_item_id: 'assessment-1', borrowing_id: 'borrowing-1', student_id: 'student-1',
    amount: 100_000, paid_amount: 25_000, status: 'partial', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  recoveryState.evidence.push({
    id: '11111111-1111-4111-8111-111111111111', settlement_id: 'charge-1', evidence_type: 'payment', object_key: 'equipment-charge-evidence/payment.jpg', storage_provider: 'r2', mime_type: 'image/jpeg', file_size_bytes: 10_000, original_filename: 'payment.jpg', upload_status: 'pending', created_by: actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, recoveryState, equipmentState), evidenceStorage);
  const charge = await service.recordChargePaymentEvent({ settlement_id: 'charge-1', payment_amount: 50_000, evidence_ids: ['11111111-1111-4111-8111-111111111111'], change_reason: 'Mencatat bukti pembayaran' }, actorId);
  assert.equal(charge.paid_amount, 75_000);
  assert.equal(charge.status, 'partial');
  assert.equal(recoveryState.evidence[0].upload_status, 'attached');
});

test('full charge payment requires resolution evidence while recovery is active', async () => {
  const equipmentState = createEquipmentMemoryState();
  const recoveryState = createEquipmentRecoveryMemoryState();
  recoveryState.charges.push({
    id: 'charge-2', assessment_item_id: 'assessment-2', borrowing_id: 'borrowing-2', student_id: 'student-2',
    amount: 100_000, paid_amount: 0, status: 'unpaid', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  recoveryState.cases.push({
    id: 'case-2', equipment_id: 'equipment-2', assessment_item_id: 'assessment-2', recovery_type: 'repair', status: 'open', reported_condition: 'rusak', inspection_photos: [], inspection_passed: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  recoveryState.evidence.push({
    id: '22222222-2222-4222-8222-222222222222', settlement_id: 'charge-2', evidence_type: 'payment', object_key: 'equipment-charge-evidence/payment-2.jpg', storage_provider: 'r2', mime_type: 'image/jpeg', file_size_bytes: 10_000, original_filename: 'payment-2.jpg', upload_status: 'pending', created_by: actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, recoveryState, equipmentState), evidenceStorage);
  await assert.rejects(
    service.recordChargePaymentEvent({ settlement_id: 'charge-2', payment_amount: 100_000, evidence_ids: ['22222222-2222-4222-8222-222222222222'], change_reason: 'Mencatat pembayaran lunas' }, actorId),
    (error: unknown) => error instanceof Error && error.message.includes('Bukti penyelesaian alat'),
  );
});

test('charge payment accepts two decimal places without floating point false positives', async () => {
  const recoveryState = createEquipmentRecoveryMemoryState();
  recoveryState.charges.push({
    id: 'charge-decimal', assessment_item_id: 'assessment-decimal', borrowing_id: 'borrowing-decimal', student_id: 'student-decimal',
    amount: 1, paid_amount: 0, status: 'unpaid', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  recoveryState.evidence.push({
    id: '33333333-3333-4333-8333-333333333333', settlement_id: 'charge-decimal', evidence_type: 'payment', object_key: 'equipment-charge-evidence/decimal.jpg', storage_provider: 'r2', mime_type: 'image/jpeg', file_size_bytes: 10_000, original_filename: 'decimal.jpg', upload_status: 'pending', created_by: actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, recoveryState, createEquipmentMemoryState()), evidenceStorage);
  const charge = await service.recordChargePaymentEvent({ settlement_id: 'charge-decimal', payment_amount: 0.29, evidence_ids: ['33333333-3333-4333-8333-333333333333'], change_reason: 'Mencatat pembayaran desimal' }, actorId);
  assert.equal(charge.paid_amount, 0.29);
});

test('charge payment rejects an evidence object with an invalid image signature before attaching it', async () => {
  const recoveryState = createEquipmentRecoveryMemoryState();
  recoveryState.charges.push({
    id: 'charge-invalid-image', assessment_item_id: 'assessment-invalid-image', borrowing_id: 'borrowing-invalid-image', student_id: 'student-invalid-image',
    amount: 10_000, paid_amount: 0, status: 'unpaid', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  recoveryState.evidence.push({
    id: '44444444-4444-4444-8444-444444444444', settlement_id: 'charge-invalid-image', evidence_type: 'payment', object_key: 'equipment-charge-evidence/invalid.png', storage_provider: 'r2', mime_type: 'image/png', file_size_bytes: 10_000, original_filename: 'invalid.png', upload_status: 'pending', created_by: actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const service = new EquipmentRecoveryService(
    createEquipmentRecoveryRepository(null, recoveryState, createEquipmentMemoryState()),
    { ...evidenceStorage, verifyUpload: async () => false },
  );

  await assert.rejects(
    service.recordChargePaymentEvent({ settlement_id: 'charge-invalid-image', payment_amount: 5_000, evidence_ids: ['44444444-4444-4444-8444-444444444444'], change_reason: 'Mencatat pembayaran validasi' }, actorId),
    (error: unknown) => error instanceof Error && error.message.includes('Unggahan bukti belum selesai'),
  );
  assert.equal(recoveryState.charges[0]?.paid_amount, 0);
  assert.equal(recoveryState.evidence[0]?.upload_status, 'pending');
});
