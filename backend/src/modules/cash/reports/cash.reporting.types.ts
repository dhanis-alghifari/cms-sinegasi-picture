import type { CashPaymentMethod, CashStudentSnapshot, CashTransactionRecord } from '../shared/cash.types.js';
import type { ActorSummary } from '../../../shared/actors/actors.types.js';

export type BillingRulesState = {
  nominal_iuran_wajib: number;
  holiday_start_date: string | null;
  holiday_end_date: string | null;
  skip_week: boolean;
  updated_by?: string;
  updated_at?: string;
  updated_actor?: ActorSummary;
};

export type CashReportRange = {
  startDate: string;
  endDate: string;
  days: number;
};

export type CashReportQuery = {
  start_date?: string;
  end_date?: string;
  metode_pembayaran?: string;
};

export type CashDebtQuery = {
  search?: string;
  page?: string;
  pageSize?: string;
};

export type CashDebtRecord = {
  id: string;
  student_id: string;
  amount: number;
  status: 'unpaid' | 'paid' | string;
  keterangan: string;
  periode: string;
  idempotency_key: string;
  tanggal?: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  student_nama?: string;
  nis?: string;
  kelas?: string;
};

export type CashReportingMemoryState = {
  transactions: CashTransactionRecord[];
  debts: CashDebtRecord[];
  students: readonly CashStudentSnapshot[];
  paymentMethods: readonly CashPaymentMethod[];
  billingRules: BillingRulesState;
};

export type CashReportResult = Record<string, unknown> & {
  period: { start_date: string; end_date: string; days: number };
};

export type CashDebtListResult = {
  data: CashDebtRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CashReportScope = { studentId: string | null };

export type BillingRulesUpdate = Partial<Pick<BillingRulesState, 'nominal_iuran_wajib' | 'holiday_start_date' | 'holiday_end_date' | 'skip_week'>> & {
  updated_by?: string;
  updated_at: string;
};
