import assert from 'node:assert/strict';
import test from 'node:test';
import { createBorrowingMutationsRepository } from './borrowing.mutations.repository.js';
import { BorrowingMutationsService, BorrowingMutationsServiceError } from './borrowing.mutations.service.js';

test('borrowing mutation service executes the complete memory workflow atomically at the module boundary', async () => {
  const returnDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const state = {
    equipment: [{ id: 'eq-1', kode_alat: 'CAM-001', nama_alat: 'Camera', kondisi: 'bagus', status: 'tersedia' }],
    borrowings: [],
    returnEvidence: [],
  };
  const storage = {
    createUpload: (fileName: string, folder: string) => ({ uploadUrl: 'https://upload.example.test/signed', key: `${folder}/${fileName}-${Math.random()}`, expiresInSeconds: 900 }),
    inspect: async (objectKey: string) => ({ exists: true, contentType: 'image/jpeg', contentLength: objectKey.includes('second') ? 101 : 100 }),
    createAccess: () => ({ accessUrl: 'https://download.example.test/signed', expiresInSeconds: 900 }),
  };
  const service = new BorrowingMutationsService(createBorrowingMutationsRepository(null, state), storage);
  const member = { userId: 'member-1', role: 'member' as const };
  const created = await service.create({
    borrower_id: 'student-1', equipment_ids: ['eq-1'], rencana_kembali: returnDate, keperluan: 'Produksi tugas film',
  }, member, 'student-1', 'member-1', 'bor-test-001');
  assert.equal(created.status, 'menunggu_persetujuan');

  const approved = await service.approveReject(created.id, { action: 'approve', alasan: 'Alat tersedia' }, 'teacher-1');
  assert.equal(approved.status, 'disetujui');
  const handedOver = await service.handover(created.id, 'teacher-1', 'Serah terima alat');
  assert.equal(handedOver.status, 'dipinjam');
  const firstEvidence = await service.reserveReturnEvidence(created.id, {
    equipment_id: 'eq-1', file_name: 'overview.jpg', content_type: 'image/jpeg', file_size_bytes: 100,
  }, 'teacher-1');
  const secondEvidence = await service.reserveReturnEvidence(created.id, {
    equipment_id: 'eq-1', file_name: 'second.jpg', content_type: 'image/jpeg', file_size_bytes: 101,
  }, 'teacher-1');
  const returned = await service.returnBorrowing(created.id, {
    item_conditions: [{ equipment_id: 'eq-1', kondisi_kembali: 'bagus', evidence_ids: [firstEvidence.evidence_id, secondEvidence.evidence_id] }],
  }, 'teacher-1', 'Alat sudah kembali');
  assert.equal(returned.status, 'dikembalikan');
  assert.equal(state.equipment[0].status, 'tersedia');
  const evidence = await service.listReturnEvidence(created.id);
  assert.equal(evidence.length, 2);
  assert.equal(evidence[0]?.access_url, 'https://download.example.test/signed');
});

test('borrowing mutation service prevents a member from creating for another student', async () => {
  const returnDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const service = new BorrowingMutationsService(createBorrowingMutationsRepository(null, {
    equipment: [{ id: 'eq-1', kode_alat: 'CAM-001', nama_alat: 'Camera', kondisi: 'bagus', status: 'tersedia' }], borrowings: [],
  }));
  await assert.rejects(
    () => service.create({ borrower_id: 'student-2', equipment_ids: ['eq-1'], rencana_kembali: returnDate, keperluan: 'Produksi tugas film' }, { userId: 'member-1', role: 'member' }, 'student-1', 'member-1'),
    (error: unknown) => error instanceof BorrowingMutationsServiceError && error.statusCode === 403,
  );
});

test('borrowing return rejects a physical condition without evidence', async () => {
  const state = {
    equipment: [{ id: 'eq-1', kode_alat: 'CAM-001', nama_alat: 'Camera', kondisi: 'bagus', status: 'tersedia' }],
    borrowings: [{
      id: 'bor-1', raw_status: 'borrowed' as const, borrower_id: 'student-1', borrower_nama: 'Siswa',
      items: [{ equipment_id: 'eq-1', kode_alat: 'CAM-001', nama_alat: 'Camera', status: 'borrowed' as const, kondisi_awal: 'bagus' }],
      tanggal_pinjam: '2026-09-01', rencana_kembali: '2026-09-12', keperluan: 'Produksi tugas film', status: 'dipinjam' as const,
      created_at: '2026-09-01T00:00:00.000Z',
    }],
  };
  const service = new BorrowingMutationsService(createBorrowingMutationsRepository(null, state), {
    createUpload: () => ({ uploadUrl: 'https://upload.example.test/signed', key: 'return/evidence.jpg', expiresInSeconds: 900 }),
    inspect: async () => ({ exists: true, contentType: 'image/jpeg', contentLength: 100 }),
    createAccess: () => ({ accessUrl: 'https://download.example.test/signed', expiresInSeconds: 900 }),
  });

  await assert.rejects(
    () => service.returnBorrowing('bor-1', { item_conditions: [{ equipment_id: 'eq-1', kondisi_kembali: 'bagus' }] }, 'teacher-1', 'Alat sudah kembali'),
    (error: unknown) => error instanceof BorrowingMutationsServiceError && error.errorCode === 'RETURN_EVIDENCE_REQUIRED',
  );
});
