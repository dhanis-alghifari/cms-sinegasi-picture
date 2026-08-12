import type { CashPaymentMethod, CashStudentSnapshot } from '../shared/cash.types.js';
import type { ActorSummary } from '../../../shared/actors/actors.types.js';

export type CashMutationTransaction = {
  id: string;
  type: 'iuran_wajib' | 'pemasukan' | 'pengeluaran';
  nominal: number;
  keterangan: string;
  tanggal: string;
  student_id?: string;
  foto_bukti_url?: string;
  saldo_sebelum: number;
  saldo_sesudah: number;
  idempotency_key: string;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  is_billing: boolean;
  payment_method_code: string;
  payment_method_label: string;
  dispute?: Record<string, unknown>;
};

export type CashDebtRecord = {
  id: string;
  student_id: string;
  amount: number;
  status: 'unpaid' | 'paid';
  keterangan: string;
  periode: string;
  idempotency_key: string;
  tanggal: string;
  created_by?: string;
  created_at: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
};

export type CashMutationStudent = CashStudentSnapshot & { is_active?: boolean };

export type CashMutationMemoryState = {
  transactions: CashMutationTransaction[];
  debts: CashDebtRecord[];
  students: readonly CashMutationStudent[];
  paymentMethods: readonly CashPaymentMethod[];
  billingRules: { nominal_iuran_wajib: number };
};

export type CashInInput = {
  nominal?: unknown;
  jumlah?: unknown;
  tanggal?: unknown;
  keterangan?: unknown;
  type?: unknown;
  student_id?: unknown;
  foto_bukti_url?: unknown;
  idempotency_key?: unknown;
  metode_pembayaran?: unknown;
};

export type CashOutInput = {
  nominal?: unknown;
  jumlah?: unknown;
  keterangan?: unknown;
  foto_bukti_url?: unknown;
  idempotency_key?: unknown;
  metode_pembayaran?: unknown;
};
