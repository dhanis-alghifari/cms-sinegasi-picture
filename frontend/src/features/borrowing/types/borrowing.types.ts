import type { ActorSummary } from '@/shared/types/common';

export const BORROWING_STATUS_VALUES = [
  'menunggu_persetujuan',
  'disetujui',
  'ditolak',
  'dipinjam',
  'dikembalikan',
  'terlambat',
] as const;

export type BorrowingStatus = typeof BORROWING_STATUS_VALUES[number];

export interface BorrowedItem {
  borrowing_item_id?: string;
  equipment_id: string;
  kode_alat: string;
  nama_alat: string;
  status?: 'pending' | 'approved' | 'borrowed' | 'returned' | 'rejected';
  kondisi_awal: string;
  kondisi_kembali?: string;
  denda_kerusakan?: number;
  replacement_value?: number;
}

export interface BorrowingRecord {
  id: string;
  borrower_id: string;
  borrower_nama: string;
  borrower_nis?: string;
  kelas?: string;
  items: BorrowedItem[];
  tanggal_pinjam: string;
  rencana_kembali: string;
  tanggal_dikembalikan?: string;
  keperluan: string; // e.g. Produksi Film Short Movie A
  status: BorrowingStatus;
  catatan_persetujuan?: string;
  catatan_pengembalian?: string;
  total_denda?: number;
  approved_by?: string;
  processed_return_by?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
  approved_actor?: ActorSummary;
  processed_return_actor?: ActorSummary;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface BorrowingFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BorrowingStatus;
  borrower_id?: string;
}

export interface BorrowingSummary {
  totalActive: number;
  pendingApproval: number;
  overdueCount: number;
  returnedToday: number;
}

export interface CreateBorrowingPayload {
  borrower_id: string;
  equipment_ids: string[];
  tanggal_pinjam: string;
  rencana_kembali: string;
  keperluan: string;
  idempotency_key?: string;
}

export interface ApproveRejectPayload {
  borrowing_id: string;
  action: 'approve' | 'reject';
  catatan?: string;
}

export interface ReturnItemCondition {
  equipment_id: string;
  kondisi_kembali: string; // e.g. bagus, sedikit_kerusakan, rusak
  settlement_method?: 'none' | 'repair' | 'replacement';
  repair_cost?: number;
  evidence_urls?: string[];
  evidence_ids?: string[];
  catatan?: string;
}

export interface ProcessReturnPayload {
  borrowing_id: string;
  tanggal_dikembalikan: string;
  item_conditions: ReturnItemCondition[];
  catatan_pengembalian?: string;
}

export interface ReturnAssessmentPreview {
  borrowing_id: string;
  return_date: string;
  damage_charge: number;
  replacement_charge: number;
  late_charge: number;
  total_charge: number;
  items: Array<{
    equipment_id: string;
    borrowing_item_id?: string;
    condition: string;
    settlement_method: 'none' | 'repair' | 'replacement';
    replacement_value?: number;
    repair_cost?: number;
    charge: number;
  }>;
}

export interface ReturnEvidenceUploadReservation {
  evidence_id: string;
  upload_url: string;
  expires_in_seconds: number;
}

export interface ReturnEvidenceAccessRecord {
  evidence_id: string;
  borrowing_id: string;
  borrowing_item_id: string;
  equipment_id: string;
  assessment_item_id?: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  created_at?: string;
  access_url: string;
  expires_in_seconds: number;
}
