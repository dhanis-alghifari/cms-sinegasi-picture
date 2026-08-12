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
  denda?: number;
};

export type BorrowingReturnInput = {
  tanggal_dikembalikan?: string;
  item_conditions?: BorrowingReturnItemCondition[];
  catatan_pengembalian?: string;
  change_reason?: string;
};

export type BorrowingMutationRecord = BorrowingReadRecord;

export type BorrowingMemoryEquipment = {
  id: string;
  kode_alat: string;
  nama_alat: string;
  kondisi: string;
  status: string;
};

export type BorrowingMemoryRecord = BorrowingReadRecord & {
  idempotency_key?: string;
  raw_status: 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned';
  items: BorrowingReadItem[];
};

export type BorrowingMutationMemoryState = {
  equipment: BorrowingMemoryEquipment[];
  borrowings: BorrowingMemoryRecord[];
};

export type BorrowingDatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};
