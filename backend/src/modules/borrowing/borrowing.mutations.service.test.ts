import assert from 'node:assert/strict';
import test from 'node:test';
import { createBorrowingMutationsRepository } from './borrowing.mutations.repository.js';
import { BorrowingMutationsService, BorrowingMutationsServiceError } from './borrowing.mutations.service.js';

test('borrowing mutation service executes the complete memory workflow atomically at the module boundary', async () => {
  const state = {
    equipment: [{ id: 'eq-1', kode_alat: 'CAM-001', nama_alat: 'Camera', kondisi: 'bagus', status: 'tersedia' }],
    borrowings: [],
  };
  const service = new BorrowingMutationsService(createBorrowingMutationsRepository(null, state));
  const member = { userId: 'member-1', role: 'member' as const };
  const created = await service.create({
    borrower_id: 'student-1', equipment_ids: ['eq-1'], rencana_kembali: '2026-08-20', keperluan: 'Produksi tugas film',
  }, member, 'student-1', 'member-1', 'bor-test-001');
  assert.equal(created.status, 'menunggu_persetujuan');

  const approved = await service.approveReject(created.id, { action: 'approve', alasan: 'Alat tersedia' }, 'teacher-1');
  assert.equal(approved.status, 'disetujui');
  const handedOver = await service.handover(created.id, 'teacher-1', 'Serah terima alat');
  assert.equal(handedOver.status, 'dipinjam');
  const returned = await service.returnBorrowing(created.id, {
    item_conditions: [{ equipment_id: 'eq-1', kondisi_kembali: 'bagus' }],
  }, 'teacher-1', 'Alat sudah kembali');
  assert.equal(returned.status, 'dikembalikan');
  assert.equal(state.equipment[0].status, 'tersedia');
});

test('borrowing mutation service prevents a member from creating for another student', async () => {
  const service = new BorrowingMutationsService(createBorrowingMutationsRepository(null, {
    equipment: [{ id: 'eq-1', kode_alat: 'CAM-001', nama_alat: 'Camera', kondisi: 'bagus', status: 'tersedia' }], borrowings: [],
  }));
  await assert.rejects(
    () => service.create({ borrower_id: 'student-2', equipment_ids: ['eq-1'], rencana_kembali: '2026-08-20', keperluan: 'Produksi tugas film' }, { userId: 'member-1', role: 'member' }, 'student-1', 'member-1'),
    (error: unknown) => error instanceof BorrowingMutationsServiceError && error.statusCode === 403,
  );
});
