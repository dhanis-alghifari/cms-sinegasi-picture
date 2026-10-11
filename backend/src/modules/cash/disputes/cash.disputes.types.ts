import type { CashTransactionRecord } from '../shared/cash.types.js';
import type { CashDebtRecord } from '../reports/cash.reporting.types.js';
import type { ActorSummary } from '../../../shared/actors/actors.types.js';

export type CashDisputeStatus = 'pending' | 'approved' | 'rejected';

export type CashDisputeQuota = {
  period: string;
  period_start: string;
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;
};

export type CashDisputeRecord = {
  id: string;
  transaction_id?: string;
  debt_record_id?: string;
  student_id: string;
  reason: string;
  bukti_sanggahan_url?: string;
  has_evidence: boolean;
  status: CashDisputeStatus;
  quota_period_start: string;
  attempt_number: number;
  previous_dispute_id?: string;
  idempotency_key?: string;
  review_note?: string;
  resolution_transaction_id?: string;
  created_by?: string;
  created_at: string;
  resolved_by?: string;
  resolved_at?: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  resolved_actor?: ActorSummary;
  student_nama?: string;
  transaction_nominal?: number;
  transaction_tanggal?: string;
  transaction_keterangan?: string;
};

export type CashDisputeMemoryState = {
  transactions: CashTransactionRecord[];
  debts?: CashDebtRecord[];
  disputes?: CashDisputeRecord[];
};

export type CreateCashDisputeInput = {
  transaction_id?: unknown;
  debt_record_id?: unknown;
  student_id?: unknown;
  alasan_sanggahan?: unknown;
  reason?: unknown;
  bukti_sanggahan_url?: unknown;
};

export type ResolveCashDisputeInput = {
  status?: unknown;
  review_note?: unknown;
  resolution_date?: unknown;
  resolution_amount?: unknown;
  payment_method_code?: unknown;
};

export type CashDisputeListQuery = {
  page?: string;
  pageSize?: string;
  status?: string;
  cursor?: string;
  limit?: string;
  scope?: 'own' | 'manage';
};

export type CreateCashDisputeResult = {
  dispute: CashDisputeRecord;
  quota: CashDisputeQuota;
  idempotentReplay: boolean;
};

export type ReviewCashDisputeResult = {
  dispute: CashDisputeRecord;
  resolutionTransactionId?: string;
  idempotentReplay: boolean;
};
