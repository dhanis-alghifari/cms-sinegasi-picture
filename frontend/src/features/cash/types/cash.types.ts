// src/features/cash/types/cash.types.ts
// Cash & Debt domain types according to PRD schema
import type { ActorSummary } from '@/shared/types/common';

export type TransactionType = 'masuk' | 'keluar';
export type DisputeStatus = 'pending' | 'resolved' | 'rejected';
export type DebtStatus = 'unpaid' | 'paid';

export interface CashPaymentMethod {
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
}

export interface CashTransaction {
  id: string;
  student_id?: string;
  student_nama?: string;
  tipe: TransactionType;
  jumlah: number;
  keterangan?: string;
  foto_bukti_url?: string;
  tanggal: string;
  idempotency_key: string;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  is_billing?: boolean;
  metode_pembayaran?: string;
  metode_pembayaran_label?: string;
  dispute?: CashDispute;
}

export interface CashDispute {
  id: string;
  transaction_id: string;
  reason: string;
  bukti_sanggahan_url: string;
  status: DisputeStatus;
  created_at: string;
}

export interface DebtRecord {
  id: string;
  student_id: string;
  student_nama?: string;
  amount: number;
  status: DebtStatus;
  source_transaction_id?: string;
  settled_transaction_id?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface BillingRule {
  id: string;
  nominal_iuran_wajib: number;
  holiday_start_date?: string;
  holiday_end_date?: string;
  skip_week: boolean;
  updated_at: string;
  updated_by?: string;
  updated_actor?: ActorSummary;
}

export interface CashSummary {
  saldoUtama: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  totalTunggakanSiswa: number;
}

export interface CreateCashInPayload {
  type?: 'iuran_wajib' | 'pemasukan';
  student_id?: string;
  tanggal: string;
  jumlah: number;
  keterangan?: string;
  foto_bukti_url?: string;
  metode_pembayaran?: string;
}

export type CashPaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface CashInResult {
  payment_status: CashPaymentStatus;
  already_recorded: boolean;
  cash_transaction: CashTransaction | null;
  debt: DebtRecord | null;
  amount_due: number;
  amount_paid: number;
  amount_outstanding: number;
  payment_method?: string | null;
}

export interface CashInApiResponse {
  success: boolean;
  data: CashTransaction | null;
  result: CashInResult;
}

export interface CreateCashOutPayload {
  jumlah: number;
  keterangan: string; // Wajib untuk pengeluaran (Tahap 2)
  foto_bukti_url?: string;
  metode_pembayaran?: string;
}

export interface CreateDisputePayload {
  transaction_id: string;
  student_id?: string;
  reason: string;
  bukti_sanggahan_url: string; // WAJIB untuk sanggahan
}

export interface UpdateBillingRulePayload {
  nominal_iuran_wajib: number;
  holiday_start_date?: string;
  holiday_end_date?: string;
  skip_week?: boolean;
}

export interface CashTransactionFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  tipe?: TransactionType;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  metode_pembayaran?: string;
}

export interface CashReportFilters {
  start_date: string;
  end_date: string;
  metode_pembayaran?: string;
}

export interface CashReportBreakdown {
  key: string;
  label: string;
  total: number;
  count?: number;
}

export interface CashReportDailyPoint {
  date: string;
  income: number;
  expense: number;
}

export interface CashReportDebtStudent {
  student_id: string;
  student_nama: string;
  nis?: string;
  kelas?: string;
  total_debt: number;
  debt_record_count: number;
  oldest_debt_date?: string;
}

export interface CashReportControl {
  opening_balance: number;
  period_net_cash_flow: number;
  expected_closing_balance: number;
  closing_balance: number;
  difference: number;
  is_balanced: boolean;
}

export interface CashReportDetail {
  id: string;
  date: string;
  type?: string;
  label?: string;
  amount: number;
  note?: string;
  student_id?: string;
  student_name?: string;
  nis?: string;
  kelas?: string;
  payment_method_code?: string;
  payment_method_label?: string;
}

export interface CashReport {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  summary: {
    total_income: number;
    total_expense: number;
    net_cash_flow: number;
    outstanding_debt: number;
    delinquent_students: number;
    debt_record_count: number;
    transaction_count: number;
  };
  flow_breakdown: CashReportBreakdown[];
  income_breakdown: CashReportBreakdown[];
  expense_breakdown: CashReportBreakdown[];
  payment_method_breakdown?: CashReportBreakdown[];
  daily: CashReportDailyPoint[];
  debts: CashReportDebtStudent[];
  control?: CashReportControl;
  income_details?: CashReportDetail[];
  expense_details?: CashReportDetail[];
}
