import type { ActorSummary } from '../../shared/actors/actors.types.js';

export type BorrowingReadQuery = {
  status?: string;
  borrower_id?: string;
  search?: string;
  page?: string;
  pageSize?: string;
};

export type BorrowingReadScope = { studentId: string | null };

export type BorrowingReadItem = {
  borrowing_item_id?: string;
  equipment_id: string;
  kode_alat: string;
  nama_alat: string;
  status?: string;
  kondisi_awal: string;
  kondisi_kembali?: string;
  denda_kerusakan?: number;
  replacement_value?: number;
};

export type BorrowingReadRecord = {
  id: string;
  borrower_id: string;
  borrower_nama: string;
  borrower_nis?: string;
  kelas?: string;
  items: BorrowingReadItem[];
  tanggal_pinjam: string;
  rencana_kembali: string;
  tanggal_dikembalikan?: string;
  keperluan: string;
  status: 'menunggu_persetujuan' | 'disetujui' | 'ditolak' | 'dipinjam' | 'dikembalikan' | 'terlambat';
  catatan_persetujuan?: string;
  catatan_pengembalian?: string;
  total_denda?: number;
  approved_by?: string;
  processed_return_by?: string;
  created_by?: string;
  updated_by?: string;
  approved_actor?: ActorSummary;
  processed_return_actor?: ActorSummary;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  created_at: string;
  updated_at?: string;
};

export type BorrowingReadPage = {
  data: BorrowingReadRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type BorrowingSummary = {
  totalActive: number;
  pendingApproval: number;
  overdueCount: number;
  returnedToday: number;
};
