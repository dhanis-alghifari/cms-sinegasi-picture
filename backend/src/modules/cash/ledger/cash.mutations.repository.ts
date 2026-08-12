import type { SupabaseClient } from '@supabase/supabase-js';
import { getBusinessTodayDate, mapCashTransaction } from '../shared/cash.helpers.js';
import type { CashMutationMemoryState, CashMutationTransaction, CashDebtRecord } from './cash.mutations.types.js';
import type { CashRepositoryError, CashTransactionRecord } from '../shared/cash.types.js';

export type CashMutationResult = {
  cashTransaction: Record<string, unknown> | null;
  result?: Record<string, unknown>;
};

export interface CashMutationsRepository {
  isConfigured(): boolean;
  recordCashIn(input: {
    studentId: string | null;
    nominal: number;
    keterangan: string;
    type: 'iuran_wajib' | 'pemasukan';
    tanggal: string;
    fotoBuktiUrl?: string;
    actorId: string;
    idempotencyKey: string;
    changeReason: string;
    paymentMethodCode: string | null;
  }): Promise<{ data: CashMutationResult | null; error: CashRepositoryError }>;
  recordCashOut(input: {
    nominal: number;
    keterangan: string;
    fotoBuktiUrl?: string;
    actorId: string;
    idempotencyKey: string;
    changeReason: string;
    paymentMethodCode: string;
  }): Promise<{ data: CashMutationResult | null; error: CashRepositoryError }>;
}

type SupabaseLike = SupabaseClient | null;

function cashImpact(transaction: CashMutationTransaction): number {
  if (transaction.is_billing) return 0;
  return transaction.type === 'pengeluaran' ? -transaction.nominal : transaction.nominal;
}

function getMemoryBalance(transactions: readonly CashMutationTransaction[]): number {
  return transactions.reduce((sum, transaction) => sum + cashImpact(transaction), 0);
}

function getBillingPeriod(date: Date): string {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((current.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${current.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function settleMemoryDebts(state: CashMutationMemoryState, studentId: string, payment: number, weeklyDue: number, createdBy: string, billingDate: Date) {
  let remaining = payment;
  const periode = getBillingPeriod(billingDate);
  const hasCurrentDebt = state.debts.some((debt) => debt.student_id === studentId && debt.periode === periode);
  const debts = state.debts
    .filter((debt) => debt.student_id === studentId && debt.status === 'unpaid')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const debt of debts) {
    if (remaining >= debt.amount) {
      remaining -= debt.amount;
      debt.amount = 0;
      debt.status = 'paid';
    } else {
      debt.amount -= remaining;
      remaining = 0;
      break;
    }
  }

  if (!hasCurrentDebt && weeklyDue > remaining) {
    const idempotencyKey = `manual-weekly-${periode}-${studentId}`;
    if (!state.debts.some((debt) => debt.idempotency_key === idempotencyKey)) {
      state.debts.push({
        id: crypto.randomUUID(), student_id: studentId, amount: weeklyDue - remaining, status: 'unpaid',
        keterangan: 'Selisih pembayaran iuran mingguan', periode, idempotency_key: idempotencyKey,
        tanggal: billingDate.toISOString().slice(0, 10), created_by: createdBy, created_at: new Date().toISOString(),
      });
    }
  }
}

function mapMemoryTransaction(transaction: CashMutationTransaction, state: CashMutationMemoryState): Record<string, unknown> {
  const student = transaction.student_id ? state.students.find((item) => item.id === transaction.student_id) : undefined;
  return mapCashTransaction({
    ...transaction,
    students: student || null,
    payment_method_id: null,
    payment_method_code: transaction.payment_method_code,
    payment_method_label: transaction.payment_method_label,
    dispute: transaction.dispute,
  });
}

function buildMemoryCashInResult(
  transaction: CashMutationTransaction | null,
  debt: CashDebtRecord | null,
  weeklyDue: number,
  nominal: number,
  paymentMethodCode: string | null,
  alreadyRecorded: boolean,
  studentId: string | null,
  state: CashMutationMemoryState,
): Record<string, unknown> {
  const outstanding = debt?.status === 'unpaid' ? debt.amount : 0;
  return {
    payment_status: outstanding > 0 ? (nominal === 0 ? 'unpaid' : 'partial') : 'paid',
    already_recorded: alreadyRecorded,
    cash_transaction: transaction ? mapMemoryTransaction(transaction, state) : null,
    debt: debt ? { ...debt, amount: Number(debt.amount) } : null,
    amount_due: studentId ? weeklyDue : 0,
    amount_paid: studentId ? Math.max(weeklyDue - outstanding, 0) : nominal,
    amount_outstanding: outstanding,
    payment_method: paymentMethodCode,
  };
}

function mapCashInResult(result: Record<string, unknown>, paymentMethod?: { code?: string; label?: string } | null): CashMutationResult {
  const rawTransaction = result.cash_transaction as Record<string, unknown> | null | undefined;
  const rawDebt = result.debt as Record<string, unknown> | null | undefined;
  const mappedResult = {
    ...result,
    cash_transaction: rawTransaction ? mapCashTransaction({ ...rawTransaction, cash_payment_methods: paymentMethod } as CashTransactionRecord) : null,
    debt: rawDebt ? { ...rawDebt, amount: Number(rawDebt.amount || 0) } : null,
    amount_due: Number(result.amount_due || 0),
    amount_paid: Number(result.amount_paid || 0),
    amount_outstanding: Number(result.amount_outstanding || 0),
  };
  return { cashTransaction: mappedResult.cash_transaction as Record<string, unknown> | null, result: mappedResult };
}

export function createCashMutationsRepository(client: SupabaseLike, state: CashMutationMemoryState): CashMutationsRepository {
  return {
    isConfigured: () => client !== null,

    async recordCashIn(input) {
      if (!client) {
        const paymentMethod = input.paymentMethodCode
          ? state.paymentMethods.find((method) => method.code === input.paymentMethodCode && method.is_active)
          : null;
        if (input.paymentMethodCode && !paymentMethod) return { data: null, error: { code: 'INVALID_PAYMENT_METHOD', message: 'Metode pembayaran tidak tersedia atau sudah dinonaktifkan.' } };
        if (input.type === 'iuran_wajib' && input.studentId && !state.students.some((student) => student.id === input.studentId && student.is_active !== false)) {
          return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Siswa aktif tidak ditemukan.' } };
        }
        const idempotent = state.transactions.find((transaction) => transaction.idempotency_key === input.idempotencyKey);
        const weeklyDue = state.billingRules.nominal_iuran_wajib;
        const billingDate = new Date(`${input.tanggal}T00:00:00.000Z`);
        const periode = getBillingPeriod(billingDate);
        if (input.nominal === 0 && input.studentId) {
          if (input.tanggal > getBusinessTodayDate()) return { data: null, error: { code: 'FUTURE_DEBT', message: 'Tunggakan belum dapat dicatat untuk tanggal yang akan datang.' } };
          const existingDebt = state.debts.find((debt) => debt.student_id === input.studentId && debt.periode === periode);
          const debt = existingDebt || {
            id: crypto.randomUUID(), student_id: input.studentId, amount: weeklyDue, status: 'unpaid' as const,
            keterangan: 'Iuran mingguan belum dibayar', periode, idempotency_key: `manual-weekly-${periode}-${input.studentId}`,
            tanggal: input.tanggal, created_by: input.actorId, created_at: new Date().toISOString(),
          };
          if (!existingDebt) state.debts.push(debt);
          return { data: { cashTransaction: null, result: buildMemoryCashInResult(null, debt, weeklyDue, 0, null, Boolean(existingDebt), input.studentId, state) }, error: null };
        }
        if (idempotent) {
          const debt = input.studentId ? state.debts.find((item) => item.student_id === input.studentId && item.periode === periode) || null : null;
          return { data: { cashTransaction: mapMemoryTransaction(idempotent, state), result: buildMemoryCashInResult(idempotent, debt, weeklyDue, input.nominal, input.paymentMethodCode, true, input.studentId, state) }, error: null };
        }
        const balance = getMemoryBalance(state.transactions);
        const transaction: CashMutationTransaction = {
          id: crypto.randomUUID(), type: input.type, nominal: input.nominal, keterangan: input.keterangan, tanggal: input.tanggal,
          student_id: input.type === 'iuran_wajib' ? input.studentId || undefined : undefined,
          foto_bukti_url: input.fotoBuktiUrl, saldo_sebelum: balance, saldo_sesudah: balance + input.nominal,
          idempotency_key: input.idempotencyKey, created_by: input.actorId, created_at: new Date().toISOString(), is_billing: false,
          payment_method_code: input.paymentMethodCode || 'cash', payment_method_label: paymentMethod?.label || 'Metode pembayaran',
        };
        state.transactions.unshift(transaction);
        if (input.type === 'iuran_wajib' && input.studentId) settleMemoryDebts(state, input.studentId, input.nominal, weeklyDue, input.actorId, billingDate);
        const debt = input.studentId ? state.debts.find((item) => item.student_id === input.studentId && item.periode === periode) || null : null;
        const result = buildMemoryCashInResult(transaction, debt, weeklyDue, input.nominal, input.paymentMethodCode, false, input.studentId, state);
        return { data: { cashTransaction: result.cash_transaction as Record<string, unknown> | null, result }, error: null };
      }

      const settings = await client.from('cash_settings').select('nominal_iuran_wajib').eq('id', true).maybeSingle();
      if (settings.error) return { data: null, error: settings.error };
      const { data, error } = await client.rpc('record_cash_in_with_status_atomic', {
        p_student_id: input.studentId,
        p_nominal: input.nominal,
        p_keterangan: input.keterangan,
        p_type: input.type,
        p_foto_bukti_url: input.fotoBuktiUrl || null,
        p_created_by: input.actorId,
        p_idempotency_key: input.idempotencyKey,
        p_change_reason: input.changeReason,
        p_weekly_due: Number(settings.data?.nominal_iuran_wajib || 5000),
        p_tanggal: input.tanggal,
        p_payment_method_code: input.paymentMethodCode,
      });
      if (error) return { data: null, error };
      const rpcResult = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!rpcResult) return { data: null, error: { code: 'EMPTY_RESULT', message: 'Pencatatan kas tidak menghasilkan hasil transaksi.' } };
      const paymentMethod = input.paymentMethodCode
        ? await client.from('cash_payment_methods').select('code,label').eq('code', input.paymentMethodCode).maybeSingle()
        : { data: null };
      return { data: mapCashInResult(rpcResult, paymentMethod.data), error: null };
    },

    async recordCashOut(input) {
      if (!client) {
        const paymentMethod = state.paymentMethods.find((method) => method.code === input.paymentMethodCode && method.is_active);
        if (!paymentMethod) return { data: null, error: { code: 'INVALID_PAYMENT_METHOD', message: 'Metode pembayaran tidak tersedia atau sudah dinonaktifkan.' } };
        const existing = state.transactions.find((transaction) => transaction.idempotency_key === input.idempotencyKey);
        if (existing) return { data: { cashTransaction: mapMemoryTransaction(existing, state) }, error: null };
        const balance = getMemoryBalance(state.transactions);
        if (input.nominal > balance) return { data: null, error: { code: 'INSUFFICIENT_BALANCE', message: 'Saldo kas tidak mencukupi untuk pengeluaran ini.' } };
        const transaction: CashMutationTransaction = {
          id: crypto.randomUUID(), type: 'pengeluaran', nominal: input.nominal, keterangan: input.keterangan,
          tanggal: new Date().toISOString().slice(0, 10), foto_bukti_url: input.fotoBuktiUrl, saldo_sebelum: balance,
          saldo_sesudah: balance - input.nominal, idempotency_key: input.idempotencyKey, created_by: input.actorId,
          created_at: new Date().toISOString(), is_billing: false, payment_method_code: input.paymentMethodCode,
          payment_method_label: paymentMethod.label,
        };
        state.transactions.unshift(transaction);
        return { data: { cashTransaction: mapMemoryTransaction(transaction, state) }, error: null };
      }
      const { data, error } = await client.rpc('record_cash_out_with_method_atomic', {
        p_nominal: input.nominal, p_keterangan: input.keterangan, p_foto_bukti_url: input.fotoBuktiUrl || null,
        p_created_by: input.actorId, p_idempotency_key: input.idempotencyKey, p_change_reason: input.changeReason,
        p_payment_method_code: input.paymentMethodCode,
      });
      if (error) return { data: null, error };
      const created = Array.isArray(data) ? data[0] : data;
      if (!created) return { data: null, error: { code: 'EMPTY_RESULT', message: 'Transaksi kas keluar tidak menghasilkan data.' } };
      const paymentMethod = await client.from('cash_payment_methods').select('code,label').eq('code', input.paymentMethodCode).maybeSingle();
      return { data: { cashTransaction: mapCashTransaction({ ...(created as Record<string, unknown>), cash_payment_methods: paymentMethod.data } as CashTransactionRecord) }, error: null };
    },
  };
}
