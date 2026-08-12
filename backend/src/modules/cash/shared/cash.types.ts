import type { ActorSummary } from '../../../shared/actors/actors.types.js';

export type CashTransactionType = 'iuran_wajib' | 'pemasukan' | 'pengeluaran';

export type CashRepositoryError = {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: unknown;
} | null;

export type CashStudentSnapshot = {
  id: string;
  nis?: string;
  nama?: string;
  kelas?: string;
};

export type CashTransactionRecord = {
  id: string;
  student_id?: string;
  type: CashTransactionType;
  nominal: number;
  keterangan?: string;
  tanggal: string;
  foto_bukti_url?: string;
  idempotency_key: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  is_billing?: boolean;
  payment_method_id?: string | null;
  payment_method_code?: string;
  payment_method_label?: string;
  students?: CashStudentSnapshot | CashStudentSnapshot[] | null;
  cash_payment_methods?: { code?: string; label?: string } | Array<{ code?: string; label?: string }> | null;
  cash_disputes?: Array<Record<string, unknown>>;
  dispute?: Record<string, unknown>;
};

export type CashTransactionQuery = {
  tipe?: string;
  search?: string;
  page?: string;
  pageSize?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  metode_pembayaran?: string;
};

export type CashSummary = {
  saldoUtama: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  totalTunggakanSiswa: number;
};

export type CashPaymentMethod = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
};

export type CashPaymentMethodInput = {
  code: unknown;
  label: unknown;
  sort_order?: unknown;
};

export type CashPaymentMethodUpdate = {
  label?: unknown;
  sort_order?: unknown;
  is_active?: unknown;
};

export type CashReadScope = {
  studentId: string | null;
};
