import type { SupabaseClient } from '@supabase/supabase-js';
import {
  formatPaymentMethodLabel,
  getBusinessTodayDate,
  isMissingCashSchemaError,
  isIsoDate,
  normalizePaymentMethodCode,
} from '../shared/cash.helpers.js';
import type { CashRepositoryError, CashTransactionRecord } from '../shared/cash.types.js';
import type {
  BillingRulesState,
  BillingRulesUpdate,
  CashDebtListResult,
  CashDebtQuery,
  CashDebtRecord,
  CashReportRange,
  CashReportResult,
  CashReportingMemoryState,
  CashReportScope,
} from './cash.reporting.types.js';

export interface CashReportingRepository {
  isConfigured(): boolean;
  getReport(range: CashReportRange, paymentMethodCode: string | null): Promise<{ data: CashReportResult | null; error: CashRepositoryError }>;
  listDebts(query: CashDebtQuery, scope: CashReportScope): Promise<{ data: CashDebtListResult | null; error: CashRepositoryError }>;
  getBillingRules(): Promise<{ data: BillingRulesState | null; error: CashRepositoryError }>;
  updateBillingRules(input: BillingRulesUpdate): Promise<{ data: BillingRulesState | null; error: CashRepositoryError }>;
}

type SupabaseLike = SupabaseClient | null;

// `debt_records` stores the record timestamp as `created_at`; unlike
// `cash_transactions`, it has no business-date `tanggal` column.
const DEBT_SELECT = 'id,student_id,amount,status,keterangan,periode,idempotency_key,settled_transaction_id,created_by,created_at,updated_by,updated_at,students(id,nis,nama,kelas),cash_disputes(id,status,reason,alasan_sanggahan,attempt_number,review_note,created_at)';
const BILLING_RULES_SELECT = 'nominal_iuran_wajib,holiday_start_date,holiday_end_date,skip_week,updated_by,updated_at';

type CashStudentJoinRow = {
  nis?: unknown;
  nama?: unknown;
  kelas?: unknown;
};

type CashDebtRow = {
  id?: unknown;
  student_id?: unknown;
  amount?: unknown;
  status?: unknown;
  keterangan?: unknown;
  periode?: unknown;
  idempotency_key?: unknown;
  settled_transaction_id?: unknown;
  created_by?: unknown;
  created_at?: unknown;
  updated_by?: unknown;
  updated_at?: unknown;
  students?: CashStudentJoinRow | CashStudentJoinRow[] | null;
  cash_disputes?: Array<{ id?: unknown; status?: unknown; reason?: unknown; alasan_sanggahan?: unknown; attempt_number?: unknown; review_note?: unknown; created_at?: unknown }> | null;
};

function sanitizeSearch(value: string): string {
  return value.trim().replace(/[%,_()]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

function parsePagination(query: CashDebtQuery): { page: number; pageSize: number; from: number; to: number } {
  const pageValue = Number(query.page);
  const pageSizeValue = Number(query.pageSize);
  const page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1;
  const pageSize = Number.isFinite(pageSizeValue) ? Math.min(100, Math.max(1, Math.floor(pageSizeValue))) : 20;
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

function formatIncomeLabel(key: string): string {
  if (key === 'iuran_wajib') return 'Iuran wajib';
  if (key === 'pemasukan') return 'Pemasukan lain-lain';
  return key;
}

function mapDebt(row: CashDebtRow): CashDebtRecord {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  const dispute = [...(row.cash_disputes ?? [])].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id || '').localeCompare(String(a.id || '')))[0];
  return {
    id: String(row.id),
    student_id: String(row.student_id),
    amount: Number(row.amount || 0),
    status: String(row.status || 'unpaid'),
    keterangan: String(row.keterangan || ''),
    periode: String(row.periode || ''),
    idempotency_key: String(row.idempotency_key || ''),
    settled_transaction_id: optionalString(row.settled_transaction_id),
    // Debt records do not have a separate business date; keep the internal
    // reporting field derived from the persisted creation timestamp.
    tanggal: optionalString(row.created_at),
    created_by: optionalString(row.created_by),
    created_at: String(row.created_at || ''),
    updated_by: optionalString(row.updated_by),
    updated_at: optionalString(row.updated_at),
    student_nama: optionalString(student?.nama),
    nis: optionalString(student?.nis),
    kelas: optionalString(student?.kelas),
    dispute: dispute ? {
      id: String(dispute.id),
      status: String(dispute.status || 'pending'),
      reason: optionalString(dispute.reason ?? dispute.alasan_sanggahan),
      has_evidence: true,
      attempt_number: Number(dispute.attempt_number || 1),
      review_note: optionalString(dispute.review_note),
    } : undefined,
  };
}

function transactionDate(transaction: CashTransactionRecord): string {
  return String(transaction.tanggal || transaction.created_at || '').slice(0, 10);
}

function cashImpact(transaction: CashTransactionRecord): number {
  if (transaction.is_billing) return 0;
  return transaction.type === 'pengeluaran' ? -Number(transaction.nominal || 0) : Number(transaction.nominal || 0);
}

function buildMemoryReport(
  range: CashReportRange,
  transactions: readonly CashTransactionRecord[],
  debts: readonly CashDebtRecord[],
  students: readonly CashReportingMemoryState['students'][number][],
): CashReportResult {
  const balanceBefore = transactions
    .filter((transaction) => transactionDate(transaction) < range.startDate)
    .reduce((sum, transaction) => sum + cashImpact(transaction), 0);
  const balanceAtEnd = transactions
    .filter((transaction) => transactionDate(transaction) <= range.endDate)
    .reduce((sum, transaction) => sum + cashImpact(transaction), 0);
  const periodTransactions = transactions.filter((transaction) => {
    const date = transactionDate(transaction);
    return date >= range.startDate && date <= range.endDate;
  });
  const periodDebts = debts.filter((debt) => {
    const date = String(debt.tanggal || debt.created_at).slice(0, 10);
    return debt.status === 'unpaid' && date >= range.startDate && date <= range.endDate;
  });
  const income = periodTransactions.filter((transaction) => !transaction.is_billing && transaction.type !== 'pengeluaran');
  const expense = periodTransactions.filter((transaction) => !transaction.is_billing && transaction.type === 'pengeluaran');
  const totalIncome = income.reduce((sum, transaction) => sum + Number(transaction.nominal || 0), 0);
  const totalExpense = expense.reduce((sum, transaction) => sum + Number(transaction.nominal || 0), 0);

  const incomeGroups = new Map<string, { total: number; count: number }>();
  for (const transaction of income) {
    const current = incomeGroups.get(transaction.type) || { total: 0, count: 0 };
    incomeGroups.set(transaction.type, { total: current.total + Number(transaction.nominal || 0), count: current.count + 1 });
  }
  const expenseGroups = new Map<string, { total: number; count: number }>();
  for (const transaction of expense) {
    const label = transaction.keterangan || 'Tanpa keterangan';
    const current = expenseGroups.get(label) || { total: 0, count: 0 };
    expenseGroups.set(label, { total: current.total + Number(transaction.nominal || 0), count: current.count + 1 });
  }
  const paymentGroups = new Map<string, { label: string; total: number; count: number }>();
  for (const transaction of income) {
    const code = transaction.payment_method_code || 'cash';
    const current = paymentGroups.get(code) || { label: formatPaymentMethodLabel(code, transaction.payment_method_label), total: 0, count: 0 };
    paymentGroups.set(code, { label: current.label, total: current.total + Number(transaction.nominal || 0), count: current.count + 1 });
  }

  const daily: Array<{ date: string; income: number; expense: number }> = [];
  const cursor = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const rows = periodTransactions.filter((transaction) => transactionDate(transaction) === date);
    daily.push({
      date,
      income: rows.filter((transaction) => !transaction.is_billing && transaction.type !== 'pengeluaran').reduce((sum, transaction) => sum + Number(transaction.nominal || 0), 0),
      expense: rows.filter((transaction) => !transaction.is_billing && transaction.type === 'pengeluaran').reduce((sum, transaction) => sum + Number(transaction.nominal || 0), 0),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const debtsByStudent = new Map<string, { totalDebt: number; recordCount: number; oldestDebtDate: string }>();
  for (const debt of periodDebts) {
    const date = String(debt.tanggal || debt.created_at).slice(0, 10);
    const current = debtsByStudent.get(debt.student_id);
    debtsByStudent.set(debt.student_id, {
      totalDebt: (current?.totalDebt || 0) + Number(debt.amount || 0),
      recordCount: (current?.recordCount || 0) + 1,
      oldestDebtDate: current?.oldestDebtDate && current.oldestDebtDate < date ? current.oldestDebtDate : date,
    });
  }
  const debtRows = Array.from(debtsByStudent.entries()).map(([studentId, debt]) => {
    const student = students.find((item) => item.id === studentId);
    return {
      student_id: studentId,
      student_nama: student?.nama || 'Siswa',
      nis: student?.nis,
      kelas: student?.kelas,
      total_debt: debt.totalDebt,
      debt_record_count: debt.recordCount,
      oldest_debt_date: debt.oldestDebtDate,
    };
  }).sort((a, b) => b.total_debt - a.total_debt || a.student_nama.localeCompare(b.student_nama));

  return {
    period: { start_date: range.startDate, end_date: range.endDate, days: range.days },
    summary: {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_cash_flow: totalIncome - totalExpense,
      outstanding_debt: periodDebts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0),
      delinquent_students: debtRows.length,
      debt_record_count: periodDebts.length,
      transaction_count: periodTransactions.filter((transaction) => !transaction.is_billing).length,
    },
    control: {
      opening_balance: balanceBefore,
      period_net_cash_flow: totalIncome - totalExpense,
      expected_closing_balance: balanceBefore + totalIncome - totalExpense,
      closing_balance: balanceAtEnd,
      difference: balanceAtEnd - (balanceBefore + totalIncome - totalExpense),
      is_balanced: Math.abs(balanceAtEnd - (balanceBefore + totalIncome - totalExpense)) <= 0.005,
    },
    flow_breakdown: [
      { key: 'income', label: 'Pemasukan', total: totalIncome },
      { key: 'expense', label: 'Pengeluaran', total: totalExpense },
    ],
    payment_method_breakdown: Array.from(paymentGroups.entries()).map(([key, value]) => ({ key, label: value.label, total: value.total, count: value.count })).sort((a, b) => b.total - a.total),
    income_breakdown: Array.from(incomeGroups.entries()).map(([key, value]) => ({
      key,
      label: formatIncomeLabel(key),
      total: value.total,
      count: value.count,
    })).sort((a, b) => b.total - a.total),
    expense_breakdown: Array.from(expenseGroups.entries()).map(([label, value]) => ({ key: 'expense', label, total: value.total, count: value.count })).sort((a, b) => b.total - a.total),
    daily,
    income_details: income.map((transaction) => {
      const student = transaction.student_id ? students.find((item) => item.id === transaction.student_id) : undefined;
      return {
        id: transaction.id,
        date: transaction.tanggal,
        type: transaction.type,
        label: formatIncomeLabel(transaction.type),
        amount: Number(transaction.nominal || 0),
        note: transaction.keterangan,
        student_id: transaction.student_id,
        student_name: student?.nama,
        nis: student?.nis,
        kelas: student?.kelas,
        payment_method_code: transaction.payment_method_code || 'cash',
        payment_method_label: formatPaymentMethodLabel(transaction.payment_method_code || 'cash', transaction.payment_method_label),
      };
    }),
    expense_details: expense.map((transaction) => ({
      id: transaction.id,
      date: transaction.tanggal,
      type: transaction.type,
      amount: Number(transaction.nominal || 0),
      note: transaction.keterangan,
      payment_method_code: transaction.payment_method_code || 'cash',
      payment_method_label: formatPaymentMethodLabel(transaction.payment_method_code || 'cash', transaction.payment_method_label),
    })),
    debts: debtRows,
  };
}

export function createCashReportingRepository(client: SupabaseLike, memory: CashReportingMemoryState): CashReportingRepository {
  return {
    isConfigured: () => client !== null,

    async getReport(range, paymentMethodCode) {
      if (!client) {
        const transactions = memory.transactions.filter((transaction) => {
          const date = transactionDate(transaction);
          return (!paymentMethodCode || (transaction.payment_method_code || 'cash') === paymentMethodCode)
            && date <= range.endDate;
        });
        return { data: buildMemoryReport(range, transactions, memory.debts, memory.students), error: null };
      }
      const { data, error } = await client.rpc('get_cash_report_with_method', {
        p_start_date: range.startDate,
        p_end_date: range.endDate,
        p_payment_method_code: paymentMethodCode,
      });
      if (error) return { data: null, error };
      const report = Array.isArray(data) ? data[0] : data;
      return { data: report && typeof report === 'object' ? report as CashReportResult : null, error: null };
    },

    async listDebts(query, scope) {
      const { page, pageSize, from, to } = parsePagination(query);
      if (!client) {
        let debts = memory.debts.filter((debt) => debt.status === 'unpaid');
        if (scope.studentId) debts = debts.filter((debt) => debt.student_id === scope.studentId);
        const search = query.search ? query.search.trim().toLowerCase() : '';
        if (search) debts = debts.filter((debt) => debt.keterangan.toLowerCase().includes(search));
        debts.sort((a, b) => b.created_at.localeCompare(a.created_at));
        const total = debts.length;
        const data = debts.slice(from, to + 1).map((debt) => ({ ...debt, student_nama: debt.student_nama || memory.students.find((student) => student.id === debt.student_id)?.nama }));
        return { data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
      }
      let dbQuery = client.from('debt_records').select(DEBT_SELECT, { count: 'exact' }).eq('status', 'unpaid');
      if (scope.studentId) dbQuery = dbQuery.eq('student_id', scope.studentId);
      const search = query.search ? sanitizeSearch(query.search) : '';
      if (search) dbQuery = dbQuery.ilike('keterangan', `%${search}%`);
      dbQuery = dbQuery.range(from, to).order('created_at', { ascending: false }).order('id', { ascending: false });
      const { data, count, error } = await dbQuery;
      if (error) return { data: null, error };
      const total = count || 0;
      const mapped = (data || []).map((row: CashDebtRow) => mapDebt(row));
      return { data: { data: mapped, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
    },

    async getBillingRules() {
      if (!client) return { data: memory.billingRules, error: null };
      const { data, error } = await client.from('cash_settings').select(BILLING_RULES_SELECT).eq('id', true).maybeSingle();
      return { data: data ? data as BillingRulesState : memory.billingRules, error: error || null };
    },

    async updateBillingRules(input) {
      if (!client) {
        Object.assign(memory.billingRules, input);
        return { data: memory.billingRules, error: null };
      }
      const payload: Record<string, unknown> = { updated_by: input.updated_by, updated_at: input.updated_at };
      if (input.nominal_iuran_wajib !== undefined) payload.nominal_iuran_wajib = input.nominal_iuran_wajib;
      if (input.holiday_start_date !== undefined) payload.holiday_start_date = input.holiday_start_date;
      if (input.holiday_end_date !== undefined) payload.holiday_end_date = input.holiday_end_date;
      if (input.skip_week !== undefined) payload.skip_week = input.skip_week;
      const { data, error } = await client.from('cash_settings').update(payload).eq('id', true).select(BILLING_RULES_SELECT).single();
      return { data: data ? data as BillingRulesState : null, error: error || null };
    },
  };
}

export { isMissingCashSchemaError };
