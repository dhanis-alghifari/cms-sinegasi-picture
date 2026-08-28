import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingCashSchemaError } from '../shared/cash.helpers.js';
import type { CashRepositoryError, CashTransactionRecord } from '../shared/cash.types.js';
import type {
  CashDisputeListQuery,
  CashDisputeMemoryState,
  CashDisputeQuota,
  CashDisputeRecord,
  CreateCashDisputeResult,
  ReviewCashDisputeResult,
} from './cash.disputes.types.js';

type RepositoryResult<T> = Promise<{ data: T | null; error: CashRepositoryError }>;

export interface CashDisputesRepository {
  isConfigured(): boolean;
  findTransaction(transactionId: string): RepositoryResult<{ student_id: string | null; type: string }>;
  findDebt(debtId: string): RepositoryResult<{ student_id: string; amount: number; status: string }>;
  findByTransaction(transactionId: string): RepositoryResult<CashDisputeRecord>;
  findByDebt(debtId: string): RepositoryResult<CashDisputeRecord>;
  getQuota(studentId: string): RepositoryResult<CashDisputeQuota>;
  getEvidence(id: string, studentId: string | null): RepositoryResult<{ url: string }>;
  list(query: CashDisputeListQuery, studentId: string | null): Promise<{
    data: CashDisputeRecord[];
    total: number;
    nextCursor: string | null;
    hasMore: boolean;
    error: CashRepositoryError;
  }>;
  createAtomic(input: {
    transactionId?: string;
    debtRecordId?: string;
    studentId: string;
    reason: string;
    proofUrl: string;
    actorId: string;
    idempotencyKey: string;
  }): RepositoryResult<CreateCashDisputeResult>;
  reviewAtomic(input: {
    id: string;
    status: 'approved' | 'rejected';
    reviewNote: string;
    actorId: string;
    resolutionDate?: string;
    resolutionAmount?: number;
    paymentMethodCode?: string;
  }): RepositoryResult<ReviewCashDisputeResult>;
}

type SupabaseLike = SupabaseClient | null;

const DISPUTE_LIST_SELECT = 'id,transaction_id,debt_record_id,student_id,reason,alasan_sanggahan,status,quota_period_start,attempt_number,previous_dispute_id,idempotency_key,review_note,resolution_transaction_id,created_by,created_at,resolved_by,resolved_at,updated_by,updated_at,students(nama),cash_transactions!cash_disputes_transaction_id_fkey(nominal,tanggal,keterangan),debt_records(amount,created_at,keterangan)';

type CashDisputeRow = {
  id?: unknown;
  transaction_id?: unknown;
  debt_record_id?: unknown;
  student_id?: unknown;
  reason?: unknown;
  alasan_sanggahan?: unknown;
  bukti_sanggahan_url?: unknown;
  has_evidence?: unknown;
  status?: unknown;
  quota_period_start?: unknown;
  attempt_number?: unknown;
  previous_dispute_id?: unknown;
  idempotency_key?: unknown;
  review_note?: unknown;
  resolution_transaction_id?: unknown;
  created_by?: unknown;
  created_at?: unknown;
  resolved_by?: unknown;
  resolved_at?: unknown;
  updated_by?: unknown;
  updated_at?: unknown;
  students?: { nama?: unknown } | Array<{ nama?: unknown }> | null;
  cash_transactions?: { nominal?: unknown; tanggal?: unknown; keterangan?: unknown } | Array<{ nominal?: unknown; tanggal?: unknown; keterangan?: unknown }> | null;
  debt_records?: { amount?: unknown; created_at?: unknown; keterangan?: unknown } | Array<{ amount?: unknown; created_at?: unknown; keterangan?: unknown }> | null;
};

type CursorValue = { createdAt: string; id: string };

function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

function mapDispute(row: CashDisputeRow, assumeEvidence = false): CashDisputeRecord {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  const transaction = Array.isArray(row.cash_transactions) ? row.cash_transactions[0] : row.cash_transactions;
  const debt = Array.isArray(row.debt_records) ? row.debt_records[0] : row.debt_records;
  const proofUrl = optionalString(row.bukti_sanggahan_url);
  return {
    id: String(row.id),
    transaction_id: optionalString(row.transaction_id),
    debt_record_id: optionalString(row.debt_record_id),
    student_id: String(row.student_id),
    reason: String(row.reason || row.alasan_sanggahan || ''),
    bukti_sanggahan_url: proofUrl,
    has_evidence: row.has_evidence === true || Boolean(proofUrl) || assumeEvidence,
    status: row.status === 'resolved' ? 'approved' : String(row.status || 'pending') as CashDisputeRecord['status'],
    quota_period_start: String(row.quota_period_start || `${String(row.created_at || '').slice(0, 7)}-01`),
    attempt_number: Math.max(1, Number(row.attempt_number || 1)),
    previous_dispute_id: optionalString(row.previous_dispute_id),
    idempotency_key: optionalString(row.idempotency_key),
    review_note: optionalString(row.review_note),
    resolution_transaction_id: optionalString(row.resolution_transaction_id),
    created_by: optionalString(row.created_by),
    created_at: String(row.created_at || ''),
    resolved_by: optionalString(row.resolved_by),
    resolved_at: optionalString(row.resolved_at),
    updated_by: optionalString(row.updated_by),
    updated_at: optionalString(row.updated_at),
    student_nama: student ? optionalString(student.nama) : undefined,
    transaction_nominal: transaction ? Number(transaction.nominal || 0) : debt ? Number(debt.amount || 0) : undefined,
    transaction_tanggal: transaction ? optionalString(transaction.tanggal) : debt ? optionalString(debt.created_at) : undefined,
    transaction_keterangan: transaction ? optionalString(transaction.keterangan) : debt ? optionalString(debt.keterangan) : undefined,
  };
}

function mapQuota(value: unknown): CashDisputeQuota {
  const row = (value || {}) as Record<string, unknown>;
  return {
    period: String(row.period || ''),
    period_start: String(row.period_start || ''),
    limit: Number(row.limit || 2),
    used: Number(row.used || 0),
    remaining: Number(row.remaining || 0),
    resets_at: String(row.resets_at || ''),
  };
}

function normalizeRpcData(value: unknown): Record<string, unknown> | null {
  const result = Array.isArray(value) ? value[0] : value;
  return result && typeof result === 'object' ? result as Record<string, unknown> : null;
}

function notFoundError(message: string): { code: string; message: string } {
  return { code: 'NOT_FOUND', message };
}

function businessError(code: string, message = code, details?: unknown): { code: string; message: string; details?: unknown } {
  return { code, message, details };
}

function businessPeriod(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}`;
}

function buildMemoryQuota(disputes: readonly CashDisputeRecord[], studentId: string): CashDisputeQuota {
  const period = businessPeriod();
  const usedRaw = disputes.filter((item) => item.student_id === studentId && item.quota_period_start.slice(0, 7) === period).length;
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const resetsAt = new Date(Date.UTC(year, month, 1) - (7 * 60 * 60 * 1000));
  return {
    period,
    period_start: `${period}-01`,
    limit: 2,
    used: Math.min(usedRaw, 2),
    remaining: Math.max(2 - usedRaw, 0),
    resets_at: resetsAt.toISOString(),
  };
}

function encodeCursor(dispute: CashDisputeRecord): string {
  return Buffer.from(JSON.stringify({ createdAt: dispute.created_at, id: dispute.id } satisfies CursorValue)).toString('base64url');
}

function decodeCursor(value: string | undefined): CursorValue | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorValue>;
    if (typeof parsed.createdAt !== 'string' || Number.isNaN(Date.parse(parsed.createdAt))) return null;
    if (typeof parsed.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(parsed.id)) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function targetMatches(dispute: CashDisputeRecord, transactionId?: string, debtRecordId?: string): boolean {
  return transactionId ? dispute.transaction_id === transactionId : dispute.debt_record_id === debtRecordId;
}

function withoutEvidence(dispute: CashDisputeRecord): CashDisputeRecord {
  const { bukti_sanggahan_url: _proof, ...safe } = dispute;
  return { ...safe, has_evidence: true };
}

export function createCashDisputesRepository(client: SupabaseLike, memory: CashDisputeMemoryState): CashDisputesRepository {
  const seededDisputes = [
    ...memory.transactions.flatMap((transaction) => transaction.dispute ? [transaction.dispute as CashDisputeRecord] : []),
    ...(memory.debts?.flatMap((debt) => (debt as typeof debt & { dispute?: CashDisputeRecord }).dispute ? [(debt as typeof debt & { dispute: CashDisputeRecord }).dispute] : []) ?? []),
  ];
  const memoryDisputes = memory.disputes ?? Array.from(new Map(seededDisputes.map((item) => [item.id, item])).values());
  memory.disputes = memoryDisputes;

  return {
    isConfigured: () => client !== null,

    async findTransaction(transactionId) {
      if (!client) {
        const transaction = memory.transactions.find((item) => item.id === transactionId);
        return { data: transaction ? { student_id: transaction.student_id || null, type: transaction.type } : null, error: null };
      }
      const { data, error } = await client.from('cash_transactions').select('student_id,type').eq('id', transactionId).maybeSingle();
      return { data: data ? { student_id: data.student_id || null, type: data.type } : null, error: error || null };
    },

    async findDebt(debtId) {
      if (!client) {
        const debt = memory.debts?.find((item) => item.id === debtId);
        return { data: debt ? { student_id: debt.student_id, amount: Number(debt.amount), status: debt.status } : null, error: null };
      }
      const { data, error } = await client.from('debt_records').select('student_id,amount,status').eq('id', debtId).maybeSingle();
      return { data: data ? { student_id: String(data.student_id), amount: Number(data.amount || 0), status: String(data.status || 'unpaid') } : null, error: error || null };
    },

    async findByTransaction(transactionId) {
      if (!client) {
        const data = memoryDisputes.filter((item) => item.transaction_id === transactionId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return { data: data || null, error: null };
      }
      const { data, error } = await client.from('cash_disputes').select(DISPUTE_LIST_SELECT).eq('transaction_id', transactionId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      return { data: data ? mapDispute(data, true) : null, error: error || null };
    },

    async findByDebt(debtId) {
      if (!client) {
        const data = memoryDisputes.filter((item) => item.debt_record_id === debtId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return { data: data || null, error: null };
      }
      const { data, error } = await client.from('cash_disputes').select(DISPUTE_LIST_SELECT).eq('debt_record_id', debtId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      return { data: data ? mapDispute(data, true) : null, error: error || null };
    },

    async getQuota(studentId) {
      if (!client) return { data: buildMemoryQuota(memoryDisputes, studentId), error: null };
      const { data, error } = await client.rpc('get_cash_dispute_quota', { p_student_id: studentId });
      return { data: error ? null : mapQuota(Array.isArray(data) ? data[0] : data), error: error || null };
    },

    async getEvidence(id, studentId) {
      if (!client) {
        const dispute = memoryDisputes.find((item) => item.id === id && (!studentId || item.student_id === studentId));
        return dispute?.bukti_sanggahan_url
          ? { data: { url: dispute.bukti_sanggahan_url }, error: null }
          : { data: null, error: notFoundError('Bukti sanggahan tidak ditemukan.') };
      }
      let request = client.from('cash_disputes').select('id,student_id,bukti_sanggahan_url').eq('id', id);
      if (studentId) request = request.eq('student_id', studentId);
      const { data, error } = await request.maybeSingle();
      const url = data?.bukti_sanggahan_url ? String(data.bukti_sanggahan_url) : '';
      return { data: url ? { url } : null, error: error || (url ? null : notFoundError('Bukti sanggahan tidak ditemukan.')) };
    },

    async list(query, studentId) {
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
      const cursorLimit = Math.min(50, Math.max(1, Number(query.limit) || pageSize));
      const cursor = decodeCursor(query.cursor);
      const cursorMode = Boolean(query.cursor || query.limit);
      const status = query.status && ['pending', 'approved', 'rejected'].includes(query.status) ? query.status : null;

      if (query.cursor && !cursor) {
        return { data: [], total: 0, nextCursor: null, hasMore: false, error: businessError('INVALID_CURSOR', 'Cursor sanggahan tidak valid.') };
      }

      if (!client) {
        let all = memoryDisputes
          .filter((dispute) => !studentId || dispute.student_id === studentId)
          .filter((dispute) => !status || dispute.status === status)
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
        const total = all.length;
        if (cursor) all = all.filter((item) => item.created_at < cursor.createdAt || (item.created_at === cursor.createdAt && item.id < cursor.id));
        const from = cursorMode ? 0 : (page - 1) * pageSize;
        const size = cursorMode ? cursorLimit : pageSize;
        const rows = all.slice(from, from + size + 1);
        const hasMore = rows.length > size;
        const data = rows.slice(0, size).map(withoutEvidence);
        return { data, total, nextCursor: hasMore && data.length ? encodeCursor(data[data.length - 1]!) : null, hasMore, error: null };
      }

      let request = client.from('cash_disputes').select(DISPUTE_LIST_SELECT, cursorMode ? undefined : { count: 'exact' });
      if (studentId) request = request.eq('student_id', studentId);
      if (status) request = request.eq('status', status);
      if (cursor) request = request.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
      request = request.order('created_at', { ascending: false }).order('id', { ascending: false });

      const size = cursorMode ? cursorLimit : pageSize;
      const from = cursorMode ? 0 : (page - 1) * pageSize;
      const { data: rows, count, error } = cursorMode
        ? await request.limit(size + 1)
        : await request.range(from, from + size - 1);
      const mapped = (rows ?? []).map((row) => mapDispute(row, true));
      const hasMore = cursorMode && mapped.length > size;
      const data = hasMore ? mapped.slice(0, size) : mapped;
      return {
        data,
        total: count ?? (cursorMode ? data.length : 0),
        nextCursor: hasMore && data.length ? encodeCursor(data[data.length - 1]!) : null,
        hasMore,
        error: error || null,
      };
    },

    async createAtomic(input) {
      if (!client) {
        const idempotent = memoryDisputes.find((item) => item.student_id === input.studentId && item.idempotency_key === input.idempotencyKey);
        if (idempotent) {
          if (!targetMatches(idempotent, input.transactionId, input.debtRecordId)) return { data: null, error: businessError('IDEMPOTENCY_KEY_REUSED') };
          return { data: { dispute: withoutEvidence(idempotent), quota: buildMemoryQuota(memoryDisputes, input.studentId), idempotentReplay: true }, error: null };
        }
        const active = memoryDisputes.find((item) => targetMatches(item, input.transactionId, input.debtRecordId) && ['pending', 'approved'].includes(item.status));
        if (active) return { data: null, error: businessError(active.status === 'pending' ? 'DISPUTE_PENDING' : 'DISPUTE_ALREADY_APPROVED') };
        const quota = buildMemoryQuota(memoryDisputes, input.studentId);
        if (quota.remaining <= 0) return { data: null, error: businessError('DISPUTE_MONTHLY_QUOTA_EXHAUSTED', 'DISPUTE_MONTHLY_QUOTA_EXHAUSTED', quota) };
        const previous = memoryDisputes.filter((item) => targetMatches(item, input.transactionId, input.debtRecordId)).sort((a, b) => b.attempt_number - a.attempt_number)[0];
        const now = new Date().toISOString();
        const dispute: CashDisputeRecord = {
          id: crypto.randomUUID(), transaction_id: input.transactionId, debt_record_id: input.debtRecordId,
          student_id: input.studentId, reason: input.reason, bukti_sanggahan_url: input.proofUrl, has_evidence: true,
          status: 'pending', quota_period_start: `${businessPeriod()}-01`, attempt_number: (previous?.attempt_number || 0) + 1,
          previous_dispute_id: previous?.id, idempotency_key: input.idempotencyKey, created_by: input.actorId, created_at: now,
          updated_by: input.actorId, updated_at: now,
        };
        memoryDisputes.push(dispute);
        const transaction = input.transactionId ? memory.transactions.find((item) => item.id === input.transactionId) : undefined;
        const debt = input.debtRecordId ? memory.debts?.find((item) => item.id === input.debtRecordId) : undefined;
        if (transaction) transaction.dispute = dispute;
        if (debt) (debt as typeof debt & { dispute: CashDisputeRecord }).dispute = dispute;
        return { data: { dispute: withoutEvidence(dispute), quota: buildMemoryQuota(memoryDisputes, input.studentId), idempotentReplay: false }, error: null };
      }

      const { data, error } = await client.rpc('create_cash_dispute_atomic', {
        p_student_id: input.studentId,
        p_transaction_id: input.transactionId || null,
        p_debt_record_id: input.debtRecordId || null,
        p_reason: input.reason,
        p_evidence_value: input.proofUrl,
        p_actor_id: input.actorId,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error) return { data: null, error };
      const result = normalizeRpcData(data);
      const dispute = result?.dispute as CashDisputeRow | undefined;
      if (!result || !dispute) return { data: null, error: businessError('EMPTY_RESULT', 'RPC sanggahan tidak mengembalikan data.') };
      return {
        data: {
          dispute: mapDispute(dispute, true),
          quota: mapQuota(result.quota),
          idempotentReplay: result.idempotent_replay === true,
        },
        error: null,
      };
    },

    async reviewAtomic(input) {
      if (!client) {
        const current = memoryDisputes.find((item) => item.id === input.id);
        if (!current) return { data: null, error: notFoundError('Sanggahan tidak ditemukan.') };
        if (current.status !== 'pending') {
          if (current.status === input.status) return { data: { dispute: withoutEvidence(current), resolutionTransactionId: current.resolution_transaction_id, idempotentReplay: true }, error: null };
          return { data: null, error: businessError('DISPUTE_ALREADY_RESOLVED') };
        }
        let resolutionTransactionId: string | undefined;
        if (input.status === 'approved' && current.debt_record_id) {
          const debt = memory.debts?.find((item) => item.id === current.debt_record_id);
          if (!debt || debt.status !== 'unpaid') return { data: null, error: businessError('DISPUTE_DEBT_ALREADY_SETTLED') };
          if (!input.resolutionDate || !input.resolutionAmount || !input.paymentMethodCode || input.resolutionAmount !== debt.amount) {
            return { data: null, error: businessError('DISPUTE_RESOLUTION_REQUIRED') };
          }
          const balance = memory.transactions.reduce((sum, item) => sum + (item.type === 'pengeluaran' ? -Number(item.nominal) : Number(item.nominal)), 0);
          resolutionTransactionId = crypto.randomUUID();
          memory.transactions.unshift({
            id: resolutionTransactionId, student_id: current.student_id, type: 'iuran_wajib', nominal: input.resolutionAmount,
            keterangan: 'Pembayaran terverifikasi melalui sanggahan kas', tanggal: input.resolutionDate,
            idempotency_key: `cash-dispute-resolution:${current.id}`,
            created_by: input.actorId, created_at: new Date().toISOString(), is_billing: false,
            saldo_sebelum: balance, saldo_sesudah: balance + input.resolutionAmount,
          } as CashTransactionRecord);
          debt.status = 'paid';
        }
        const now = new Date().toISOString();
        Object.assign(current, {
          status: input.status, review_note: input.reviewNote, resolved_by: input.actorId, resolved_at: now,
          updated_by: input.actorId, updated_at: now, resolution_transaction_id: resolutionTransactionId,
        });
        return { data: { dispute: withoutEvidence(current), resolutionTransactionId, idempotentReplay: false }, error: null };
      }

      const { data, error } = await client.rpc('review_cash_dispute_atomic', {
        p_dispute_id: input.id,
        p_status: input.status,
        p_review_note: input.reviewNote,
        p_actor_id: input.actorId,
        p_resolution_date: input.resolutionDate || null,
        p_resolution_amount: input.resolutionAmount ?? null,
        p_payment_method_code: input.paymentMethodCode || null,
      });
      if (error) return { data: null, error };
      const result = normalizeRpcData(data);
      const dispute = result?.dispute as CashDisputeRow | undefined;
      if (!result || !dispute) return { data: null, error: businessError('EMPTY_RESULT', 'RPC review sanggahan tidak mengembalikan data.') };
      return {
        data: {
          dispute: mapDispute(dispute, true),
          resolutionTransactionId: optionalString(result.resolution_transaction_id),
          idempotentReplay: result.idempotent_replay === true,
        },
        error: null,
      };
    },
  };
}

export { isMissingCashSchemaError };
