import assert from 'node:assert/strict';
import test from 'node:test';
import { createContestEntriesRepository } from './contest-entries.repository.js';
import { ContestEntriesService, ContestEntriesServiceError } from './contest-entries.service.js';
import type { ContestEvidenceStorage } from './contest-entries.types.js';

const storage: ContestEvidenceStorage = {
  createUpload: (fileName, folder) => ({ uploadUrl: 'https://upload.example.test/signed', key: `${folder}/${fileName}`, expiresInSeconds: 900 }),
  inspect: async () => ({ exists: true }),
  createAccess: () => ({ accessUrl: 'https://download.example.test/signed', expiresInSeconds: 900 }),
};

const context = { idempotencyKey: 'contest-operation-001' };

function createService() {
  return new ContestEntriesService(createContestEntriesRepository(null, { works: [], entries: [], evidence: [], statusHistory: [] }), storage);
}

test('contest entries create a generalized work and list it by contest', async () => {
  const service = createService();
  const entry = await service.create({
    contest_id: 'cnt-001',
    work: { title: 'Foto Senja', work_type_code: 'photography', primary_asset_url: 'https://example.test/foto.jpg' },
  }, 'user-1');

  assert.equal(entry.work?.work_type_code, 'photography');
  const listed = await service.list('cnt-001', {});
  assert.equal(listed.total, 1);
  assert.equal(listed.data[0]?.work?.title, 'Foto Senja');
});

test('contest entries reject incomplete work target and enforce evidence rules', async () => {
  const service = createService();
  await assert.rejects(
    () => service.create({ contest_id: 'cnt-001' }, 'user-1'),
    (error: unknown) => error instanceof ContestEntriesServiceError && error.errorCode === 'WORK_TARGET_INVALID',
  );

  const entry = await service.create({ contest_id: 'cnt-001', work: { title: 'Film Baru', work_type_code: 'short_film' } }, 'user-1');
  await assert.rejects(
    () => service.transition(entry.id, { status: 'sudah_terkirim', change_reason: 'Kirim karya' }, 'user-1', context),
    (error: unknown) => error instanceof ContestEntriesServiceError && error.errorCode === 'CONTEST_ENTRY_EVIDENCE_REQUIRED',
  );
  await assert.rejects(
    () => service.transition(entry.id, { status: 'selesai', change_reason: 'Selesaikan karya' }, 'user-1', context),
    (error: unknown) => error instanceof ContestEntriesServiceError && error.errorCode === 'CONTEST_ENTRY_STATUS_INVALID',
  );
});

test('contest entries transition records pipeline status and history', async () => {
  const state = { works: [], entries: [], evidence: [], statusHistory: [] as Array<{ entry_id: string; from_status: 'proses_submit'; to_status: 'sudah_terkirim'; change_reason: string; changed_by: string | null; created_at: string }> };
  const service = new ContestEntriesService(createContestEntriesRepository(null, state), storage);
  const entry = await service.create({ contest_id: 'cnt-001', work: { title: 'Animasi Baru', work_type_code: 'animation' } }, 'user-1');
  const reservation = await service.reserveEvidence(entry.id, { target_status: 'sudah_terkirim', file_name: 'bukti.png', content_type: 'image/png', file_size_bytes: 100 }, 'user-1');
  const updated = await service.transition(entry.id, { status: 'sudah_terkirim', evidence_id: reservation.evidence_id, change_reason: 'Bukti sudah dikirim' }, 'user-1', context);
  assert.equal(updated.pipeline_status, 'sudah_terkirim');
  assert.equal(state.statusHistory.length, 1);
});

test('contest entries finalize an awarded result atomically after the sequential pipeline', async () => {
  const state = { works: [], entries: [], evidence: [], statusHistory: [] };
  const service = new ContestEntriesService(createContestEntriesRepository(null, state), storage);
  const entry = await service.create({ contest_id: 'cnt-001', work: { title: 'Film Finalis', work_type_code: 'short_film' } }, 'user-1');
  const submission = await service.reserveEvidence(entry.id, { target_status: 'sudah_terkirim', file_name: 'submission.png', content_type: 'image/png', file_size_bytes: 100 }, 'user-1');
  await service.transition(entry.id, { status: 'sudah_terkirim', evidence_id: submission.evidence_id, change_reason: 'Bukti pengiriman diterima' }, 'user-1', { idempotencyKey: 'contest-operation-002' });
  await service.transition(entry.id, { status: 'menunggu_pengumuman', change_reason: 'Menunggu hasil penjurian' }, 'user-1', { idempotencyKey: 'contest-operation-003' });
  const resultEvidence = await service.reserveEvidence(entry.id, { target_status: 'selesai', file_name: 'result.png', content_type: 'image/png', file_size_bytes: 100 }, 'user-1');
  const finalized = await service.finalize(entry.id, {
    outcome_status: 'awarded',
    evidence_id: resultEvidence.evidence_id,
    change_reason: 'Hasil resmi sudah diumumkan',
    results: [{ result_kind: 'rank', result_title: 'Best Student Film', position: 1 }],
  }, 'user-1', { idempotencyKey: 'contest-operation-004' });
  assert.equal(finalized.entry.pipeline_status, 'selesai');
  assert.equal(finalized.entry.outcome_status, 'awarded');
  assert.equal(finalized.entry.result_label, 'Best Student Film');
  assert.equal(finalized.results.length, 1);
});
