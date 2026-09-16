import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BORROWING_SELECT, loadLatestReplacementValues, mapBorrowingRow } from './borrowing.read.repository.js';
import type { BorrowingReadRecord } from './borrowing.read.types.js';
import type {
  BorrowingDatabaseError,
  BorrowingMemoryRecord,
  BorrowingMutationMemoryState,
  BorrowingMutationRecord,
  BorrowingReturnItemCondition,
  BorrowingReturnAssessmentPreview,
  BorrowingMemoryEquipment,
  BorrowingReturnEvidenceRecord,
} from './borrowing.mutations.types.js';

type SupabaseLike = SupabaseClient | null;
const RETURN_EVIDENCE_LIST_LIMIT = 50;

type CreateInput = {
  studentId: string;
  equipmentIds: string[];
  tanggalPinjam: string;
  rencanaKembali: string;
  keperluan: string;
  actorId: string;
  idempotencyKey: string;
};

type ApproveInput = { borrowingId: string; action: 'approve' | 'reject'; catatan: string | null; actorId: string; changeReason: string };
type HandoverInput = { borrowingId: string; actorId: string; changeReason: string };
type ReturnInput = { borrowingId: string; returnedAt: string; itemConditions: BorrowingReturnItemCondition[]; catatan: string | null; actorId: string; changeReason: string };

export interface BorrowingMutationsRepository {
  isConfigured(): boolean;
  create(input: CreateInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  approveReject(input: ApproveInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  handover(input: HandoverInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  returnBorrowing(input: ReturnInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  previewReturn(input: { borrowingId: string; returnedAt: string; itemConditions: BorrowingReturnItemCondition[] }): Promise<{ data: BorrowingReturnAssessmentPreview | null; error: BorrowingDatabaseError | null }>;
  reserveReturnEvidence(input: {
    borrowingId: string;
    equipmentId: string;
    objectKey: string;
    mimeType: string;
    fileSizeBytes: number;
    originalFilename: string;
    actorId: string;
  }): Promise<{ data: BorrowingReturnEvidenceRecord | null; error: BorrowingDatabaseError | null }>;
  getReturnEvidence(evidenceId: string): Promise<{ data: BorrowingReturnEvidenceRecord | null; error: BorrowingDatabaseError | null }>;
  listReturnEvidence(borrowingId: string): Promise<{ data: BorrowingReturnEvidenceRecord[]; error: BorrowingDatabaseError | null }>;
}

function mapReturnEvidence(row: Record<string, unknown>): BorrowingReturnEvidenceRecord {
  return {
    id: String(row.id),
    borrowing_id: String(row.borrowing_id),
    borrowing_item_id: String(row.borrowing_item_id),
    equipment_id: String(row.equipment_id),
    assessment_item_id: row.assessment_item_id === null || row.assessment_item_id === undefined ? null : String(row.assessment_item_id),
    object_key: String(row.object_key),
    storage_provider: 'r2',
    mime_type: String(row.mime_type),
    file_size_bytes: Number(row.file_size_bytes),
    original_filename: String(row.original_filename),
    upload_status: String(row.upload_status) as BorrowingReturnEvidenceRecord['upload_status'],
    created_by: row.created_by === null || row.created_by === undefined ? null : String(row.created_by),
    created_at: row.created_at === null || row.created_at === undefined ? undefined : String(row.created_at),
    updated_at: row.updated_at === null || row.updated_at === undefined ? undefined : String(row.updated_at),
  };
}

async function findById(client: SupabaseClient, id: string): Promise<{ data: BorrowingReadRecord | null; error: BorrowingDatabaseError | null }> {
  const result = await client.from('borrowings').select(BORROWING_SELECT).eq('id', id).maybeSingle();
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: null };
  const replacementValues = await loadLatestReplacementValues(client, [result.data as unknown as Record<string, unknown>]);
  if (replacementValues.error) return { data: null, error: replacementValues.error };
  return { data: mapBorrowingRow(result.data, replacementValues.data), error: null };
}

function error(code: string, message: string): BorrowingDatabaseError { return { code, message }; }

function memoryCharge(condition: BorrowingReturnItemCondition, equipment: BorrowingMemoryEquipment | undefined): number {
  if (condition.kondisi_kembali === 'bagus') return 0;
  if (condition.settlement_method === 'none') return 0;
  if (condition.settlement_method === 'repair') return Number(condition.repair_cost || 0);
  if (condition.settlement_method === 'replacement') return Number(equipment?.replacement_value || 0);
  return 0;
}

function getDefaultSettlementMethod(condition: BorrowingReturnItemCondition['kondisi_kembali']): 'none' | 'repair' | 'replacement' {
  if (condition === 'bagus') return 'none';
  if (condition === 'hilang') return 'replacement';
  return 'repair';
}

function withChargeBreakdown(preview: BorrowingReturnAssessmentPreview): BorrowingReturnAssessmentPreview {
  const replacementCharge = preview.items.reduce((total, item) => total + (item.settlement_method === 'replacement' ? item.charge : 0), 0);
  const repairCharge = preview.items.reduce((total, item) => total + (item.settlement_method === 'repair' ? item.charge : 0), 0);
  return {
    ...preview,
    damage_charge: repairCharge,
    replacement_charge: replacementCharge,
    total_charge: repairCharge + replacementCharge + preview.late_charge,
  };
}

function asMemoryRecord(record: BorrowingMemoryRecord): BorrowingMutationRecord {
  const { raw_status: _rawStatus, idempotency_key: _idempotencyKey, ...publicRecord } = record;
  return publicRecord;
}

function memoryCreate(state: BorrowingMutationMemoryState, input: CreateInput): { data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null } {
  const existing = state.borrowings.find((item) => item.idempotency_key === input.idempotencyKey);
  if (existing) return { data: asMemoryRecord(existing), error: null };
  const equipment = input.equipmentIds.map((id) => state.equipment.find((item) => item.id === id));
  if (equipment.some((item) => !item)) return { data: null, error: error('NOT_FOUND', 'Salah satu alat tidak ditemukan.') };
  if (equipment.some((item) => item?.status !== 'tersedia')) return { data: null, error: error('CONFLICT', 'Salah satu alat tidak sedang tersedia.') };
  const now = new Date().toISOString();
  const record: BorrowingMemoryRecord = {
    id: `bor-${crypto.randomUUID()}`,
    idempotency_key: input.idempotencyKey,
    raw_status: 'pending',
    borrower_id: input.studentId,
    borrower_nama: 'Siswa',
    items: equipment.filter(Boolean).map((item) => ({
      equipment_id: item!.id,
      kode_alat: item!.kode_alat,
      nama_alat: item!.nama_alat,
      status: 'pending',
      kondisi_awal: item!.kondisi || 'bagus',
      denda_kerusakan: 0,
      replacement_value: item!.replacement_value,
    })),
    tanggal_pinjam: input.tanggalPinjam,
    rencana_kembali: input.rencanaKembali,
    keperluan: input.keperluan,
    status: 'menunggu_persetujuan',
    total_denda: 0,
    created_by: input.actorId,
    created_at: now,
  };
  state.borrowings.unshift(record);
  return { data: asMemoryRecord(record), error: null };
}

function memoryApprove(state: BorrowingMutationMemoryState, input: ApproveInput): { data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null } {
  const record = state.borrowings.find((item) => item.id === input.borrowingId);
  if (!record) return { data: null, error: error('NOT_FOUND', 'Pengajuan peminjaman tidak ditemukan.') };
  if (record.raw_status !== 'pending') return { data: null, error: error('ALREADY_PROCESSED', 'Pengajuan ini sudah diproses sebelumnya.') };
  record.raw_status = input.action === 'approve' ? 'approved' : 'rejected';
  record.status = input.action === 'approve' ? 'disetujui' : 'ditolak';
  record.catatan_persetujuan = input.catatan || undefined;
  record.approved_by = input.actorId;
  record.updated_by = input.actorId;
  record.updated_at = new Date().toISOString();
  record.items = record.items.map((item) => ({ ...item, status: record.raw_status }));
  return { data: asMemoryRecord(record), error: null };
}

function memoryHandover(state: BorrowingMutationMemoryState, input: HandoverInput): { data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null } {
  const record = state.borrowings.find((item) => item.id === input.borrowingId);
  if (!record) return { data: null, error: error('NOT_FOUND', 'Peminjaman tidak ditemukan.') };
  if (record.raw_status !== 'approved') return { data: null, error: error('CONFLICT', 'Peminjaman belum disetujui atau sudah diserahkan.') };
  record.raw_status = 'borrowed'; record.status = 'dipinjam'; record.approved_by = record.approved_by || input.actorId;
  record.updated_by = input.actorId; record.updated_at = new Date().toISOString();
  record.items = record.items.map((item) => ({ ...item, status: 'borrowed' }));
  for (const item of record.items) {
    const equipment = state.equipment.find((entry) => entry.id === item.equipment_id);
    if (equipment) equipment.status = 'dipinjam';
  }
  return { data: asMemoryRecord(record), error: null };
}

function memoryReturn(state: BorrowingMutationMemoryState, input: ReturnInput): { data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null } {
  const record = state.borrowings.find((item) => item.id === input.borrowingId);
  if (!record) return { data: null, error: error('NOT_FOUND', 'Peminjaman tidak ditemukan.') };
  if (record.raw_status !== 'borrowed') return { data: null, error: error('CONFLICT', 'Peminjaman belum berada pada status dapat dikembalikan.') };
  const activeIds = record.items.filter((item) => item.status === 'borrowed').map((item) => item.equipment_id).sort();
  const returnedIds = input.itemConditions.map((item) => item.equipment_id).sort();
  if (activeIds.length !== returnedIds.length || activeIds.some((id, index) => id !== returnedIds[index])) {
    return { data: null, error: error('INVALID_INPUT', 'Kondisi pengembalian harus diisi untuk setiap alat yang masih dipinjam.') };
  }
  let totalFine = 0;
  for (const condition of input.itemConditions) {
    const equipment = state.equipment.find((entry) => entry.id === condition.equipment_id);
    const fine = memoryCharge(condition, equipment);
    if (condition.kondisi_kembali !== 'bagus' && fine <= 0) return { data: null, error: error('INVALID_INPUT', 'Nilai penggantian atau biaya perbaikan wajib tersedia.') };
    totalFine += fine;
    for (const evidenceId of condition.evidence_ids ?? []) {
      const evidence = state.returnEvidence?.find((candidate) => candidate.id === evidenceId);
      if (evidence) {
        evidence.upload_status = 'attached';
        evidence.updated_at = new Date().toISOString();
      }
    }
    if (equipment) { equipment.kondisi = condition.kondisi_kembali; equipment.status = condition.kondisi_kembali === 'bagus' ? 'tersedia' : 'maintenance'; }
  }
  const conditionMap = new Map(input.itemConditions.map((item) => [item.equipment_id, item]));
  record.items = record.items.map((item) => {
    const condition = conditionMap.get(item.equipment_id);
    const fine = condition ? memoryCharge(condition, state.equipment.find((entry) => entry.id === condition.equipment_id)) : 0;
    return { ...item, status: 'returned', kondisi_kembali: condition?.kondisi_kembali, denda_kerusakan: fine };
  });
  record.raw_status = 'returned'; record.status = 'dikembalikan'; record.tanggal_dikembalikan = input.returnedAt;
  record.catatan_pengembalian = input.catatan || undefined; record.total_denda = totalFine;
  record.processed_return_by = input.actorId; record.updated_by = input.actorId; record.updated_at = new Date().toISOString();
  return { data: asMemoryRecord(record), error: null };
}

export function createBorrowingMutationsRepository(client: SupabaseLike, state: BorrowingMutationMemoryState): BorrowingMutationsRepository {
  return {
    isConfigured: () => client !== null,
    async create(input) {
      if (!client) return memoryCreate(state, input);
      const result = await client.rpc('create_borrowing_atomic', {
        p_student_id: input.studentId, p_equipment_ids: input.equipmentIds,
        p_tanggal_pinjam: input.tanggalPinjam, p_rencana_kembali: input.rencanaKembali,
        p_keperluan: input.keperluan, p_created_by: input.actorId, p_idempotency_key: input.idempotencyKey,
      });
      if (result.error) return { data: null, error: result.error };
      return findById(client, String(result.data));
    },
    async approveReject(input) {
      if (!client) return memoryApprove(state, input);
      const result = await client.rpc('approve_borrowing_atomic', {
        p_borrowing_id: input.borrowingId, p_action: input.action, p_catatan: input.catatan,
        p_approved_by: input.actorId, p_change_reason: input.changeReason,
      });
      if (result.error) return { data: null, error: result.error };
      return findById(client, input.borrowingId);
    },
    async handover(input) {
      if (!client) return memoryHandover(state, input);
      const result = await client.rpc('handover_borrowing_atomic', {
        p_borrowing_id: input.borrowingId, p_handover_by: input.actorId, p_change_reason: input.changeReason,
      });
      if (result.error) return { data: null, error: result.error };
      return findById(client, input.borrowingId);
    },
    async returnBorrowing(input) {
      if (!client) return memoryReturn(state, input);
      const result = await client.rpc('return_borrowing_atomic', {
        p_borrowing_id: input.borrowingId, p_returned_at: input.returnedAt,
        p_item_conditions: input.itemConditions, p_catatan: input.catatan,
        p_returned_by: input.actorId, p_change_reason: input.changeReason,
      });
      if (result.error) return { data: null, error: result.error };
      return findById(client, input.borrowingId);
    },
    async previewReturn(input) {
      if (!client) {
        const record = state.borrowings.find((item) => item.id === input.borrowingId);
        if (!record) return { data: null, error: error('NOT_FOUND', 'Peminjaman tidak ditemukan.') };
        const items = input.itemConditions.map((item) => {
          const equipment = state.equipment.find((entry) => entry.id === item.equipment_id);
          const charge = memoryCharge(item, equipment);
          return { equipment_id: item.equipment_id, borrowing_item_id: record.items.find((entry) => entry.equipment_id === item.equipment_id)?.borrowing_item_id, condition: item.kondisi_kembali, settlement_method: item.settlement_method || getDefaultSettlementMethod(item.kondisi_kembali), replacement_value: equipment?.replacement_value, repair_cost: item.repair_cost, charge };
        });
        if (items.some((item) => item.condition !== 'bagus' && item.charge <= 0)) return { data: null, error: error('INVALID_INPUT', 'Nilai penggantian atau biaya perbaikan wajib tersedia.') };
        const total = items.reduce((sum, item) => sum + item.charge, 0);
        return { data: withChargeBreakdown({ borrowing_id: input.borrowingId, return_date: input.returnedAt, damage_charge: total, replacement_charge: 0, late_charge: 0, total_charge: total, items }), error: null };
      }
      const result = await client.rpc('preview_return_assessment', {
        p_borrowing_id: input.borrowingId,
        p_returned_at: input.returnedAt,
        p_item_conditions: input.itemConditions,
      });
      if (result.error) return { data: null, error: result.error };
      return { data: withChargeBreakdown(result.data as BorrowingReturnAssessmentPreview), error: null };
    },
    async reserveReturnEvidence(input) {
      if (!client) {
        const record = state.borrowings.find((candidate) => candidate.id === input.borrowingId);
        const borrowingItem = record?.items.find((item) => item.equipment_id === input.equipmentId && item.status === 'borrowed');
        if (!record || !borrowingItem) return { data: null, error: error('NOT_FOUND', 'Alat tidak ditemukan dalam peminjaman aktif.') };
        const evidence = state.returnEvidence ?? (state.returnEvidence = []);
        const existing = evidence.find((item) => item.object_key === input.objectKey);
        if (existing) return { data: existing, error: null };
        const now = new Date().toISOString();
        const created: BorrowingReturnEvidenceRecord = {
          id: crypto.randomUUID(),
          borrowing_id: input.borrowingId,
          borrowing_item_id: borrowingItem.borrowing_item_id || '',
          equipment_id: input.equipmentId,
          assessment_item_id: null,
          object_key: input.objectKey,
          storage_provider: 'r2',
          mime_type: input.mimeType,
          file_size_bytes: input.fileSizeBytes,
          original_filename: input.originalFilename,
          upload_status: 'pending',
          created_by: input.actorId,
          created_at: now,
          updated_at: now,
        };
        evidence.push(created);
        return { data: created, error: null };
      }
      const result = await client.rpc('reserve_borrowing_return_evidence_atomic', {
        p_borrowing_id: input.borrowingId,
        p_equipment_id: input.equipmentId,
        p_object_key: input.objectKey,
        p_mime_type: input.mimeType,
        p_file_size_bytes: input.fileSizeBytes,
        p_original_filename: input.originalFilename,
        p_actor_id: input.actorId,
      });
      if (result.error) return { data: null, error: result.error };
      const payload = result.data as { evidence?: Record<string, unknown> } | null;
      if (!payload?.evidence) return { data: null, error: error('PGRST204', 'RPC tidak mengembalikan bukti pengembalian.') };
      return { data: mapReturnEvidence(payload.evidence), error: null };
    },
    async getReturnEvidence(evidenceId) {
      if (!client) return { data: (state.returnEvidence ?? []).find((item) => item.id === evidenceId) ?? null, error: null };
      const result = await client.from('borrowing_return_evidence')
        .select('id,borrowing_id,borrowing_item_id,equipment_id,assessment_item_id,object_key,storage_provider,mime_type,file_size_bytes,original_filename,upload_status,created_by,created_at,updated_at')
        .eq('id', evidenceId)
        .maybeSingle();
      if (result.error) return { data: null, error: result.error };
      return { data: result.data ? mapReturnEvidence(result.data as unknown as Record<string, unknown>) : null, error: null };
    },
    async listReturnEvidence(borrowingId) {
      if (!client) {
        return {
          data: (state.returnEvidence ?? [])
            .filter((item) => item.borrowing_id === borrowingId && item.upload_status === 'attached')
            .sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || ''))),
          error: null,
        };
      }
      const result = await client.from('borrowing_return_evidence')
        .select('id,borrowing_id,borrowing_item_id,equipment_id,assessment_item_id,object_key,storage_provider,mime_type,file_size_bytes,original_filename,upload_status,created_by,created_at,updated_at')
        .eq('borrowing_id', borrowingId)
        .eq('upload_status', 'attached')
        .order('created_at', { ascending: true })
        .limit(RETURN_EVIDENCE_LIST_LIMIT);
      if (result.error) return { data: [], error: result.error };
      return {
        data: (result.data || []).map((row) => mapReturnEvidence(row as unknown as Record<string, unknown>)),
        error: null,
      };
    },
  };
}
