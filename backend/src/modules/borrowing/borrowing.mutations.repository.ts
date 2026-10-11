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
  BorrowingReturnEvidenceAccessRecord,
  BorrowingReturnReportEvidenceUploadInput,
  BorrowingReturnReportRecord,
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
type ReturnReportEvidenceInput = {
  borrowingId: string; equipmentId: string; objectKey: string; mimeType: string;
  fileSizeBytes: number; originalFilename: string; actorId: string;
};

export interface BorrowingMutationsRepository {
  isConfigured(): boolean;
  create(input: CreateInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  approveReject(input: ApproveInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  handover(input: HandoverInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  returnBorrowing(input: ReturnInput): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  getActiveBorrowingEquipmentIds(borrowingId: string): Promise<{ data: string[] | null; error: BorrowingDatabaseError | null }>;
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
  reserveReturnReportEvidence(input: ReturnReportEvidenceInput): Promise<{ data: (BorrowingReturnEvidenceRecord & { report_id?: string | null }) | null; error: BorrowingDatabaseError | null }>;
  submitReturnReport(input: { borrowingId: string; reportId: string; evidenceIds: string[]; notes: string | null; actorId: string; idempotencyKey: string; changeReason: string }): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  verifyReturnReport(input: { borrowingId: string; reportId: string; decision: string; verificationMethod: string | null; itemConditions: BorrowingReturnItemCondition[]; rejectionReason: string | null; actorId: string; idempotencyKey: string; changeReason: string }): Promise<{ data: BorrowingMutationRecord | null; error: BorrowingDatabaseError | null }>;
  hasReturnVerificationOperation(idempotencyKey: string): Promise<{ data: boolean | null; error: BorrowingDatabaseError | null }>;
  getReturnReportStatus(reportId: string): Promise<{ data: { id: string; borrowing_id: string; reporter_id: string; status: BorrowingReturnReportRecord['status'] } | null; error: BorrowingDatabaseError | null }>;
  getReturnReport(borrowingId: string): Promise<{ data: BorrowingReturnReportRecord | null; error: BorrowingDatabaseError | null }>;
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
    return_report_id: row.return_report_id === null || row.return_report_id === undefined ? null : String(row.return_report_id),
    source: row.source === 'student_report' ? 'student_report' : 'teacher_return',
  };
}

function mapReturnReport(row: Record<string, unknown>, evidence: BorrowingReturnEvidenceAccessRecord[]): BorrowingReturnReportRecord {
  return {
    id: String(row.id), borrowing_id: String(row.borrowing_id), reporter_id: String(row.reporter_id),
    status: String(row.status) as BorrowingReturnReportRecord['status'],
    notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
    rejection_reason: row.rejection_reason === null || row.rejection_reason === undefined ? null : String(row.rejection_reason),
    verification_method: row.verification_method === null || row.verification_method === undefined ? null : String(row.verification_method),
    verified_by: row.verified_by === null || row.verified_by === undefined ? null : String(row.verified_by),
    reported_at: row.reported_at === null || row.reported_at === undefined ? null : String(row.reported_at),
    verified_at: row.verified_at === null || row.verified_at === undefined ? null : String(row.verified_at),
    evidence,
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
  if (record.raw_status !== 'borrowed' && record.raw_status !== 'partial') return { data: null, error: error('CONFLICT', 'Peminjaman belum berada pada status dapat dikembalikan.') };
  const activeIds = record.items.filter((item) => item.status === 'borrowed').map((item) => item.equipment_id).sort();
  const returnedIds = input.itemConditions.map((item) => item.equipment_id).sort();
  if (returnedIds.length === 0 || new Set(returnedIds).size !== returnedIds.length || returnedIds.some((id) => !activeIds.includes(id))) {
    return { data: null, error: error('INVALID_INPUT', 'Kondisi pengembalian hanya dapat diisi untuk alat aktif yang belum dikembalikan.') };
  }
  const assessedItems = input.itemConditions.map((condition) => {
    const equipment = state.equipment.find((entry) => entry.id === condition.equipment_id);
    const fine = memoryCharge(condition, equipment);
    return { condition, equipment, fine };
  });
  if (assessedItems.some(({ condition, fine }) => condition.kondisi_kembali !== 'bagus' && fine <= 0)) {
    return { data: null, error: error('INVALID_INPUT', 'Nilai penggantian atau biaya perbaikan wajib tersedia.') };
  }
  const totalFine = assessedItems.reduce((total, item) => total + item.fine, 0);
  for (const { condition, equipment } of assessedItems) {
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
    if (!condition) return item;
    const fine = memoryCharge(condition, state.equipment.find((entry) => entry.id === condition.equipment_id));
    return { ...item, status: 'returned', kondisi_kembali: condition.kondisi_kembali, denda_kerusakan: fine };
  });
  const hasActiveItems = record.items.some((item) => item.status === 'borrowed');
  record.raw_status = hasActiveItems ? 'partial' : 'returned';
  record.status = hasActiveItems ? 'dipinjam' : 'dikembalikan';
  if (!hasActiveItems) record.tanggal_dikembalikan = input.returnedAt;
  record.catatan_pengembalian = input.catatan || record.catatan_pengembalian;
  record.total_denda = Number(record.total_denda || 0) + totalFine;
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
    async getActiveBorrowingEquipmentIds(borrowingId) {
      if (!client) {
        const record = state.borrowings.find((item) => item.id === borrowingId);
        if (!record) return { data: null, error: error('NOT_FOUND', 'Peminjaman tidak ditemukan.') };
        return {
          data: record.items.filter((item) => item.status === 'borrowed').map((item) => item.equipment_id),
          error: null,
        };
      }
      const result = await client.from('borrowing_items')
        .select('equipment_id')
        .eq('borrowing_id', borrowingId)
        .eq('status', 'borrowed');
      if (result.error) return { data: null, error: result.error };
      return { data: (result.data || []).map((row) => String(row.equipment_id)), error: null };
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
        .select('id,borrowing_id,borrowing_item_id,equipment_id,assessment_item_id,object_key,storage_provider,mime_type,file_size_bytes,original_filename,upload_status,created_by,created_at,updated_at,return_report_id,source')
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
        .select('id,borrowing_id,borrowing_item_id,equipment_id,assessment_item_id,object_key,storage_provider,mime_type,file_size_bytes,original_filename,upload_status,created_by,created_at,updated_at,return_report_id,source')
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
    async reserveReturnReportEvidence(input) {
      if (!client) return { data: null, error: error('NOT_CONFIGURED', 'Database belum dikonfigurasi.') };
      const result = await client.rpc('reserve_borrowing_self_return_evidence_atomic', {
        p_borrowing_id: input.borrowingId, p_equipment_id: input.equipmentId, p_object_key: input.objectKey,
        p_mime_type: input.mimeType, p_file_size_bytes: input.fileSizeBytes,
        p_original_filename: input.originalFilename, p_actor_id: input.actorId,
      });
      if (result.error) return { data: null, error: result.error };
      const payload = result.data as { evidence?: Record<string, unknown>; report_id?: string | null } | null;
      if (!payload?.evidence) return { data: null, error: error('PGRST204', 'RPC tidak mengembalikan bukti pengembalian.') };
      return { data: { ...mapReturnEvidence(payload.evidence), report_id: payload.report_id ?? null }, error: null };
    },
    async submitReturnReport(input) {
      if (!client) return { data: null, error: error('NOT_CONFIGURED', 'Database belum dikonfigurasi.') };
      const result = await client.rpc('submit_borrowing_self_return_atomic', {
        p_report_id: input.reportId, p_evidence_ids: input.evidenceIds, p_notes: input.notes,
        p_actor_id: input.actorId, p_idempotency_key: input.idempotencyKey, p_change_reason: input.changeReason,
      });
      if (result.error) return { data: null, error: result.error };
      return findById(client, input.borrowingId);
    },
    async verifyReturnReport(input) {
      if (!client) return { data: null, error: error('NOT_CONFIGURED', 'Database belum dikonfigurasi.') };
      const result = await client.rpc('verify_borrowing_self_return_atomic', {
        p_report_id: input.reportId, p_decision: input.decision, p_verification_method: input.verificationMethod,
        p_item_conditions: input.itemConditions, p_rejection_reason: input.rejectionReason,
        p_verified_by: input.actorId, p_idempotency_key: input.idempotencyKey, p_change_reason: input.changeReason,
      });
      if (result.error) return { data: null, error: result.error };
      return findById(client, input.borrowingId);
    },
    async hasReturnVerificationOperation(idempotencyKey) {
      if (!client) return { data: false, error: null };
      const result = await client.from('borrowing_return_operations')
        .select('idempotency_key')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (result.error) return { data: null, error: result.error };
      return { data: Boolean(result.data), error: null };
    },
    async getReturnReportStatus(reportId) {
      if (!client) return { data: null, error: null };
      const result = await client.from('borrowing_return_reports')
        .select('id,borrowing_id,reporter_id,status')
        .eq('id', reportId)
        .maybeSingle();
      if (result.error) return { data: null, error: result.error };
      if (!result.data) return { data: null, error: null };
      const row = result.data as Record<string, unknown>;
      return {
        data: {
          id: String(row.id), borrowing_id: String(row.borrowing_id), reporter_id: String(row.reporter_id),
          status: String(row.status) as BorrowingReturnReportRecord['status'],
        },
        error: null,
      };
    },
    async getReturnReport(borrowingId) {
      if (!client) return { data: null, error: null };
      const reportResult = await client.from('borrowing_return_reports')
        .select('id,borrowing_id,reporter_id,status,notes,rejection_reason,verification_method,verified_by,reported_at,verified_at')
        .eq('borrowing_id', borrowingId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (reportResult.error) return { data: null, error: reportResult.error };
      if (!reportResult.data) return { data: null, error: null };
      const evidenceResult = await client.from('borrowing_return_evidence')
        .select('id,borrowing_id,borrowing_item_id,equipment_id,assessment_item_id,object_key,storage_provider,mime_type,file_size_bytes,original_filename,upload_status,created_by,created_at,updated_at,return_report_id,source')
        .eq('return_report_id', String((reportResult.data as Record<string, unknown>).id))
        .in('upload_status', ['pending', 'attached'])
        .order('created_at', { ascending: true }).limit(50);
      if (evidenceResult.error) return { data: null, error: evidenceResult.error };
      const evidence = (evidenceResult.data || []).map((row) => mapReturnEvidence(row as unknown as Record<string, unknown>));
      return { data: mapReturnReport(reportResult.data as unknown as Record<string, unknown>, evidence.map((item) => ({
        evidence_id: item.id, borrowing_id: item.borrowing_id, borrowing_item_id: item.borrowing_item_id,
        equipment_id: item.equipment_id, assessment_item_id: item.assessment_item_id,
        original_filename: item.original_filename, mime_type: item.mime_type, file_size_bytes: item.file_size_bytes,
        created_at: item.created_at, access_url: item.object_key, expires_in_seconds: 0,
        return_report_id: item.return_report_id, source: item.source,
      }))), error: null };
    },
  };
}
