import type { CashTransactionRecord } from '../shared/cash.types.js';
import type { ActorSummary } from '../../../shared/actors/actors.types.js';

export type CashDisputeStatus = 'pending' | 'approved' | 'rejected';

export type CashDisputeRecord = {
  id: string;
  transaction_id: string;
  student_id: string;
  reason: string;
  bukti_sanggahan_url: string;
  status: CashDisputeStatus;
  created_by?: string;
  created_at: string;
  resolved_by?: string;
  resolved_at?: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  resolved_actor?: ActorSummary;
};

export type CashDisputeMemoryState = {
  transactions: CashTransactionRecord[];
};

export type CreateCashDisputeInput = {
  transaction_id?: unknown;
  student_id?: unknown;
  alasan_sanggahan?: unknown;
  reason?: unknown;
  bukti_sanggahan_url?: unknown;
};

export type ResolveCashDisputeInput = {
  status?: unknown;
};
