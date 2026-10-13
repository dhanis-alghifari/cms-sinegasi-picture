import assert from 'node:assert/strict';
import test from 'node:test';
import { AgendaService } from '../agenda/agenda.service.js';
import { createAgendaRepository } from '../agenda/agenda.repository.js';
import { ContestEntriesService } from '../contest-entries/contest-entries.service.js';
import { createContestEntriesRepository } from '../contest-entries/contest-entries.repository.js';
import type { ContestEntriesMemoryState } from '../contest-entries/contest-entries.types.js';
import { BorrowingMutationsService } from '../borrowing/borrowing.mutations.service.js';
import { createBorrowingMutationsRepository } from '../borrowing/borrowing.mutations.repository.js';
import type { BorrowingReturnEvidenceRecord } from '../borrowing/borrowing.mutations.types.js';
import { EquipmentRecoveryService } from '../equipment/equipment.recovery.service.js';
import { createEquipmentRecoveryRepository } from '../equipment/equipment.recovery.repository.js';
import { createEquipmentRecoveryMemoryState } from '../equipment/equipment.recovery.helpers.js';
import { createEquipmentMemoryState } from '../equipment/equipment.helpers.js';
import { SocialMediaService } from '../social-media/social-media.service.js';
import { createSocialMediaRepository } from '../social-media/social-media.repository.js';
import type { SocialEvidence, SocialPublication } from '../social-media/social-media.types.js';

const privateKey = 'staging-v2/private/photo.png';
const metadata = { objectKey: privateKey, contentType: 'image/png', fileSizeBytes: 128 };
const denied = (error: unknown) => error instanceof Error && 'statusCode' in error && [403, 404].includes(Number(error.statusCode));

test('real agenda service rejects mismatched, abandoned and archived photos on fresh lookup', async () => {
  const service = new AgendaService(createAgendaRepository(null, { activities: [] }));
  const { data } = await service.create({ activity_date: '2020-01-01', activity_name: 'Kegiatan', activity_description: 'Dokumentasi', pic_names: ['PIC'] }, 'actor-1', {});
  data.photo = { id: 'photo-1', activity_id: data.id, object_key: privateKey, upload_status: 'attached', mime_type: 'image/png', file_size_bytes: 128, original_filename: 'photo.png', created_at: '2020-01-01' };
  assert.deepEqual(await service.photoMedia(data.id, 'photo-1'), metadata);
  await assert.rejects(() => service.photoMedia('other-parent', 'photo-1'), denied);
  await assert.rejects(() => service.photoMedia(data.id, 'other-photo'), denied);
  data.photo.upload_status = 'abandoned';
  await assert.rejects(() => service.photoMedia(data.id, 'photo-1'), denied);
  data.photo.upload_status = 'attached';
  await service.archive(data.id, 'Arsip kegiatan', 'actor-1', 'archive-media-1', {});
  await assert.rejects(() => service.photoMedia(data.id, 'photo-1'), denied);
});

test('real contest service requires completed parent and attached private evidence, never legacy public URL', async () => {
  const state: ContestEntriesMemoryState = { works: [], entries: [], statusHistory: [], evidence: [] };
  const service = new ContestEntriesService(createContestEntriesRepository(null, state));
  const entry = await service.create({ contest_id: 'contest-1', work: { title: 'Karya', work_type_code: 'photography' } }, 'actor-1');
  state.evidence!.push({ id: 'evidence-1', entry_id: entry.id, evidence_type: 'result', storage_provider: 'r2', object_key: privateKey, mime_type: 'image/png', file_size_bytes: 128, upload_status: 'attached' });
  await assert.rejects(() => service.evidenceMedia(entry.id, 'evidence-1'), denied);
  state.entries[0]!.pipeline_status = 'selesai';
  assert.deepEqual(await service.evidenceMedia(entry.id, 'evidence-1'), metadata);
  await assert.rejects(() => service.evidenceMedia('other-entry', 'evidence-1'), denied);
  state.evidence![0]!.upload_status = 'pending';
  await assert.rejects(() => service.evidenceMedia(entry.id, 'evidence-1'), denied);
  state.evidence![0]!.upload_status = 'attached';
  state.evidence![0]!.storage_provider = 'legacy_url';
  state.evidence![0]!.public_url = 'https://public.example.test/photo';
  await assert.rejects(() => service.getEvidenceAccess('evidence-1'), denied);
});

test('real return report service checks reporter, current report membership and evidence source', async () => {
  const evidence: BorrowingReturnEvidenceRecord = { id: 'evidence-1', borrowing_id: 'borrowing-1', borrowing_item_id: 'item-1', equipment_id: 'eq-1', object_key: privateKey, storage_provider: 'r2', mime_type: 'image/png', file_size_bytes: 128, original_filename: 'photo.png', upload_status: 'attached', source: 'student_report', return_report_id: 'report-1' };
  const repository = createBorrowingMutationsRepository(null, { equipment: [], borrowings: [], returnEvidence: [evidence] });
  repository.getReturnReport = async () => ({ data: { id: 'report-1', borrowing_id: 'borrowing-1', reporter_id: 'owner-1', status: 'pending_verification', evidence: [{ evidence_id: evidence.id, borrowing_id: evidence.borrowing_id, borrowing_item_id: evidence.borrowing_item_id, equipment_id: evidence.equipment_id, original_filename: evidence.original_filename, mime_type: evidence.mime_type, file_size_bytes: evidence.file_size_bytes, access_url: privateKey, expires_in_seconds: 0 }] }, error: null });
  const service = new BorrowingMutationsService(repository);
  assert.deepEqual(await service.returnEvidenceMedia('borrowing-1', 'evidence-1', { teacher: false, id: 'owner-1' }), metadata);
  await assert.rejects(() => service.returnEvidenceMedia('borrowing-1', 'evidence-1', { teacher: false, id: 'other-1' }), denied);
  await assert.rejects(() => service.returnEvidenceMedia('other-borrowing', 'evidence-1', { teacher: true, id: null }), denied);
  await assert.rejects(() => service.returnEvidenceMedia('borrowing-1', 'evidence-1'), denied);
  evidence.return_report_id = 'old-report';
  await assert.rejects(() => service.returnEvidenceMedia('borrowing-1', 'evidence-1', { teacher: true, id: null }), denied);
  evidence.return_report_id = 'report-1'; evidence.upload_status = 'pending';
  await assert.rejects(() => service.returnEvidenceMedia('borrowing-1', 'evidence-1', { teacher: false, id: 'owner-1' }), denied);
});

test('real charge service requires attached evidence belonging to the requested settlement', async () => {
  const state = createEquipmentRecoveryMemoryState();
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  state.evidence.push({ id, settlement_id: 'charge-1', evidence_type: 'payment', object_key: privateKey, storage_provider: 'r2', mime_type: 'image/png', file_size_bytes: 128, original_filename: 'photo.png', upload_status: 'attached', created_at: '2020-01-01', updated_at: '2020-01-01' });
  const service = new EquipmentRecoveryService(createEquipmentRecoveryRepository(null, state, createEquipmentMemoryState()));
  assert.deepEqual(await service.chargeEvidenceMedia('charge-1', id), metadata);
  await assert.rejects(() => service.chargeEvidenceMedia('other-charge', id), denied);
  state.evidence[0]!.upload_status = 'abandoned';
  await assert.rejects(() => service.chargeEvidenceMedia('charge-1', id), denied);
});

test('real social service requires fresh parent linkage and attached evidence for publication/insight', async () => {
  const repository = createSocialMediaRepository(null, { accounts: [], publications: [], snapshots: [], insightPeriods: [] });
  const publication: SocialPublication = { id: 'publication-1', social_account_id: 'account-1', platform: 'instagram', content_type: 'story', caption: 'Kegiatan', published_at: '2020-01-01', platform_url: null, status: 'recorded', version: 1, created_by: null, created_at: '2020-01-01', updated_at: '2020-01-01', evidence: [] };
  const evidence: SocialEvidence = { id: 'evidence-1', publication_id: publication.id, object_key: privateKey, mime_type: 'image/png', file_size_bytes: 128, original_filename: 'photo.png', upload_status: 'attached', created_at: '2020-01-01' };
  repository.getPublication = async () => ({ data: publication });
  repository.getEvidence = async () => ({ data: evidence });
  const service = new SocialMediaService(repository);
  assert.deepEqual(await service.evidenceMedia('publication', publication.id, evidence.id), metadata);
  await assert.rejects(() => service.evidenceMedia('publication', 'other-publication', evidence.id), denied);
  evidence.upload_status = 'pending';
  await assert.rejects(() => service.evidenceMedia('publication', publication.id, evidence.id), denied);
  evidence.upload_status = 'attached'; repository.getPublication = async () => ({ data: null });
  await assert.rejects(() => service.evidenceMedia('publication', publication.id, evidence.id), denied);
  await assert.rejects(() => service.evidenceMedia('insight_period', 'period-1', evidence.id), denied);
});
