import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingCashSchemaError } from '../shared/cash.helpers.js';
import type { CashRepositoryError, CashTransactionRecord } from '../shared/cash.types.js';
import type { CashDisputeMemoryState, CashDisputeRecord } from './cash.disputes.types.js';

export interface CashDisputesRepository {
  isConfigured(): boolean;
  findTransaction(transactionId: string): Promise<{ data: { student_id: string | null; type: string } | null; error: CashRepositoryError }>;
  findByTransaction(transactionId: string): Promise<{ data: CashDisputeRecord | null; error: CashRepositoryError }>;
  create(input: { transactionId: string; studentId: string; reason: string; proofUrl: string; actorId: string }): Promise<{ data: CashDisputeRecord | null; error: CashRepositoryError }>;
  update(id: string, status: 'approved' | 'rejected', actorId: string): Promise<{ data: CashDisputeRecord | null; error: CashRepositoryError }>;
}

type SupabaseLike = SupabaseClient | null;

const DISPUTE_SELECT = 'id,transaction_id,student_id,reason,alasan_sanggahan,bukti_sanggahan_url,status,created_by,created_at,resolved_by,resolved_at,updated_by,updated_at';

type CashDisputeRow = {
  id?: unknown;
  transaction_id?: unknown;
  student_id?: unknown;
  reason?: unknown;
  alasan_sanggahan?: unknown;
  bukti_sanggahan_url?: unknown;
  status?: unknown;
  created_by?: unknown;
  created_at?: unknown;
  resolved_by?: unknown;
  resolved_at?: unknown;
  updated_by?: unknown;
  updated_at?: unknown;
};

function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

function mapDispute(row: CashDisputeRow): CashDisputeRecord {
  return {
    id: String(row.id),
    transaction_id: String(row.transaction_id),
    student_id: String(row.student_id),
    reason: String(row.reason || row.alasan_sanggahan || ''),
    bukti_sanggahan_url: String(row.bukti_sanggahan_url || ''),
    status: row.status === 'resolved' ? 'approved' : String(row.status || 'pending') as CashDisputeRecord['status'],
    created_by: optionalString(row.created_by),
    created_at: String(row.created_at || ''),
    resolved_by: optionalString(row.resolved_by),
    resolved_at: optionalString(row.resolved_at),
    updated_by: optionalString(row.updated_by),
    updated_at: optionalString(row.updated_at),
  };
}

function notFoundError(message: string): { code: string; message: string } {
  return { code: 'NOT_FOUND', message };
}

export function createCashDisputesRepository(client: SupabaseLike, memory: CashDisputeMemoryState): CashDisputesRepository {
  return {
    isConfigured: () => client !== null,

    async findTransaction(transactionId) {
      if (!client) {
        const transaction = memory.transactions.find((item) => item.id === transactionId);
        return {
          data: transaction ? { student_id: transaction.student_id || null, type: transaction.type } : null,
          error: null,
        };
      }
      const { data, error } = await client.from('cash_transactions').select('student_id,type').eq('id', transactionId).maybeSingle();
      return { data: data ? { student_id: data.student_id || null, type: data.type } : null, error: error || null };
    },

    async findByTransaction(transactionId) {
      if (!client) {
        const transaction = memory.transactions.find((item) => item.id === transactionId);
        return { data: transaction?.dispute ? transaction.dispute as CashDisputeRecord : null, error: null };
      }
      const { data, error } = await client.from('cash_disputes').select(DISPUTE_SELECT).eq('transaction_id', transactionId).maybeSingle();
      return { data: data ? mapDispute(data) : null, error: error || null };
    },

    async create(input) {
      if (!client) {
        const transaction = memory.transactions.find((item) => item.id === input.transactionId);
        if (!transaction) return { data: null, error: notFoundError('Transaksi kas masuk tidak ditemukan.') };
        if (transaction.dispute) return { data: null, error: { code: 'DUPLICATE', message: 'Transaksi ini sudah pernah disanggah.' } };
        const now = new Date().toISOString();
        const dispute: CashDisputeRecord = {
          id: crypto.randomUUID(), transaction_id: input.transactionId, student_id: input.studentId,
          reason: input.reason, bukti_sanggahan_url: input.proofUrl, status: 'pending', created_by: input.actorId, created_at: now,
        };
        transaction.dispute = dispute;
        return { data: dispute, error: null };
      }
      const { data, error } = await client.from('cash_disputes').insert({
        transaction_id: input.transactionId,
        student_id: input.studentId,
        reason: input.reason,
        bukti_sanggahan_url: input.proofUrl,
        created_by: input.actorId,
      }).select(DISPUTE_SELECT).single();
      return { data: data ? mapDispute(data) : null, error: error || null };
    },

    async update(id, status, actorId) {
      if (!client) {
        const transaction = memory.transactions.find((item) => item.dispute?.id === id);
        if (!transaction?.dispute) return { data: null, error: notFoundError('Sanggahan tidak ditemukan.') };
        const now = new Date().toISOString();
        const current = transaction.dispute as CashDisputeRecord;
        const updated: CashDisputeRecord = { ...current, status, resolved_by: actorId, resolved_at: now, updated_by: actorId, updated_at: now };
        transaction.dispute = updated;
        return { data: updated, error: null };
      }
      const now = new Date().toISOString();
      const { data, error } = await client.from('cash_disputes').update({
        status, resolved_by: actorId, resolved_at: now, updated_by: actorId, updated_at: now,
      }).eq('id', id).select(DISPUTE_SELECT).single();
      return { data: data ? mapDispute(data) : null, error: error || null };
    },
  };
}

export { isMissingCashSchemaError };
