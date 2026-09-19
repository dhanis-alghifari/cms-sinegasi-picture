import type { BorrowingReadItem, BorrowingReadRecord } from './borrowing.read.types.js';

export type BorrowingCreateInput = {
  student_id?: string;
  borrower_id?: string;
  equipment_ids?: string[];
  tanggal_pinjam?: string;
  rencana_kembali?: string;
  due_at?: string;
  keperluan?: string;
  keterangan?: string;
  idempotency_key?: string;
};

export type BorrowingApprovalInput = {
  action: 'approve' | 'reject';
  catatan?: string;
  alasan?: string;
  change_reason?: string;
};

export type BorrowingReturnItemCondition = {
  equipment_id: string;
  kondisi_kembali: string;
  catatan?: string;
  settlement_method?: 'none' | 'repair' | 'replacement';
  repair_cost?: number;
  evidence_urls?: string[];
  evidence_ids?: string[];
};

export type BorrowingReturnInput = {
  tanggal_dikembalikan?: string;
  item_conditions?: BorrowingReturnItemCondition[];
  catatan_pengembalian?: string;
  change_reason?: string;
};

export type BorrowingReturnAssessmentPreview = {
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
};

export type BorrowingMutationRecord = BorrowingReadRecord;

export type BorrowingMemoryEquipment = {
  id: string;
  kode_alat: string;
  nama_alat: string;
  kondisi: string;
  status: string;
  replacement_value?: number;
};

export type BorrowingMemoryRecord = BorrowingReadRecord & {
  idempotency_key?: string;
  raw_status: 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned';
  items: BorrowingReadItem[];
};

export type BorrowingMutationMemoryState = {
  equipment: BorrowingMemoryEquipment[];
  borrowings: BorrowingMemoryRecord[];
  returnEvidence?: BorrowingReturnEvidenceRecord[];
};

export type BorrowingReturnEvidenceRecord = {
  id: string;
  borrowing_id: string;
  borrowing_item_id: string;
  equipment_id: string;
  assessment_item_id?: string | null;
  object_key: string;
  storage_provider: 'r2';
  mime_type: string;
  file_size_bytes: number;
  original_filename: string;
  upload_status: 'pending' | 'attached' | 'abandoned';
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  return_report_id?: string | null;
  source?: 'teacher_return' | 'student_report';
};

export type BorrowingReturnReportEvidenceUploadInput = {
  equipment_id: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
};

export type BorrowingReturnReportSubmitInput = {
  report_id: string;
  evidence_ids: string[];
  notes?: string;
  idempotency_key?: string;
  change_reason?: string;
};

export type BorrowingReturnReportVerifyInput = {
  report_id: string;
  decision: 'approve' | 'reject';
  verification_method?: 'photo' | 'physical_check' | 'photo_and_physical';
  item_conditions?: BorrowingReturnItemCondition[];
  rejection_reason?: string;
  idempotency_key?: string;
  change_reason?: string;
};

export type BorrowingReturnReportRecord = {
  id: string;
  borrowing_id: string;
  reporter_id: string;
  status: 'draft' | 'pending_verification' | 'approved' | 'rejected';
  notes?: string | null;
  rejection_reason?: string | null;
  verification_method?: string | null;
  verified_by?: string | null;
  reported_at?: string | null;
  verified_at?: string | null;
  evidence: BorrowingReturnEvidenceAccessRecord[];
};

export type BorrowingReturnEvidenceAccessRecord = {
  evidence_id: string;
  borrowing_id: string;
  borrowing_item_id: string;
  equipment_id: string;
  assessment_item_id?: string | null;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  created_at?: string;
  access_url: string;
  expires_in_seconds: number;
  return_report_id?: string | null;
  source?: 'teacher_return' | 'student_report';
};

export type BorrowingReturnEvidenceUploadInput = {
  equipment_id: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
};

export interface BorrowingReturnEvidenceStorage {
  createUpload(fileName: string, folder: string): { uploadUrl: string; key: string; expiresInSeconds: number };
  inspect(objectKey: string): Promise<{ exists: boolean; contentType?: string; contentLength?: number }>;
  createAccess(objectKey: string): { accessUrl: string; expiresInSeconds: number };
}

export type BorrowingDatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};
