import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BORROWING_SELECT, mapBorrowingRow } from './borrowing.read.repository.js';
import type { BorrowingReadRecord } from './borrowing.read.types.js';
import type {
  BorrowingDatabaseError,
  BorrowingMemoryRecord,
  BorrowingMutationMemoryState,
  BorrowingMutationRecord,
  BorrowingReturnItemCondition,
} from './borrowing.mutations.types.js';

type SupabaseLike = SupabaseClient | null;

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
}

async function findById(client: SupabaseClient, id: string): Promise<{ data: BorrowingReadRecord | null; error: BorrowingDatabaseError | null }> {
  const result = await client.from('borrowings').select(BORROWING_SELECT).eq('id', id).maybeSingle();
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ? mapBorrowingRow(result.data) : null, error: null };
}

function error(code: string, message: string): BorrowingDatabaseError { return { code, message }; }

function fineForCondition(condition: string): number {
  return {
    bagus: 0,
    sedikit_kerusakan: 50_000,
    rusak: 200_000,
    rusak_besar: 300_000,
    sedang_diperbaiki: 200_000,
    hilang: 500_000,
  }[condition] ?? -1;
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
    const fine = fineForCondition(condition.kondisi_kembali);
    if (fine < 0) return { data: null, error: error('INVALID_INPUT', 'Kondisi pengembalian alat tidak valid.') };
    totalFine += fine;
    const equipment = state.equipment.find((entry) => entry.id === condition.equipment_id);
    if (equipment) { equipment.kondisi = condition.kondisi_kembali; equipment.status = condition.kondisi_kembali === 'bagus' ? 'tersedia' : 'maintenance'; }
  }
  const conditionMap = new Map(input.itemConditions.map((item) => [item.equipment_id, item]));
  record.items = record.items.map((item) => {
    const condition = conditionMap.get(item.equipment_id);
    const fine = condition ? fineForCondition(condition.kondisi_kembali) : 0;
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
  };
}
