import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePaymentMethodCode } from '../shared/cash.helpers.js';
import type {
  CashReadScope,
  CashStudentSnapshot,
  CashSummary,
  CashTransactionQuery,
  CashTransactionRecord,
  CashRepositoryError,
} from '../shared/cash.types.js';

export interface CashReadRepository {
  isConfigured(): boolean;
  getSummary(scope: CashReadScope): Promise<{ data: CashSummary | null; error: CashRepositoryError }>;
  listTransactions(query: CashTransactionQuery, scope: CashReadScope): Promise<{ data: CashTransactionRecord[]; count: number; error: CashRepositoryError }>;
}

type MemoryCashStore = {
  transactions: readonly CashTransactionRecord[];
  students: readonly CashStudentSnapshot[];
  debts: readonly MemoryDebtSnapshot[];
};

type MemoryDebtSnapshot = {
  student_id: string;
  amount: number;
  status: 'unpaid' | 'paid' | string;
};

type SupabaseLike = SupabaseClient | null;

const TRANSACTION_SELECT = 'id,student_id,type,nominal,keterangan,foto_bukti_url,tanggal,idempotency_key,created_by,created_at,updated_by,updated_at,is_billing,payment_method_id,cash_payment_methods(code,label),students(id,nis,nama,kelas),cash_disputes!cash_disputes_transaction_id_fkey(id,transaction_id,reason,alasan_sanggahan,status,attempt_number,review_note,created_at)';

function sanitizeSearch(value: string): string {
  return value.trim().replace(/[%,_()]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

function emptySummary(): CashSummary {
  return { saldoUtama: 0, totalPemasukan: 0, totalPengeluaran: 0, totalTunggakanSiswa: 0 };
}

function buildMemorySummary(
  transactions: readonly CashTransactionRecord[],
  debts: readonly MemoryDebtSnapshot[],
  studentId: string | null,
): CashSummary {
  const totalPemasukan = transactions
    .filter((transaction) => !transaction.is_billing && transaction.type !== 'pengeluaran')
    .reduce((sum, transaction) => sum + Number(transaction.nominal || 0), 0);
  const totalPengeluaran = transactions
    .filter((transaction) => transaction.type === 'pengeluaran')
    .reduce((sum, transaction) => sum + Number(transaction.nominal || 0), 0);
  const saldoUtama = transactions.reduce((sum, transaction) => {
    if (transaction.is_billing) return sum;
    return sum + (transaction.type === 'pengeluaran' ? -Number(transaction.nominal || 0) : Number(transaction.nominal || 0));
  }, 0);
  const totalTunggakanSiswa = debts
    .filter((debt) => debt.status === 'unpaid' && (!studentId || debt.student_id === studentId))
    .reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  return { saldoUtama, totalPemasukan, totalPengeluaran, totalTunggakanSiswa };
}

function hydrateMemoryTransaction(
  transaction: CashTransactionRecord,
  students: readonly CashStudentSnapshot[],
): CashTransactionRecord {
  if (transaction.students || !transaction.student_id) return transaction;
  return {
    ...transaction,
    students: students.find((student) => student.id === transaction.student_id) || null,
  };
}

export function createCashReadRepository(client: SupabaseLike, memory: MemoryCashStore): CashReadRepository {
  return {
    isConfigured: () => client !== null,

    async getSummary(scope) {
      if (!client) {
        const transactions = scope.studentId
          ? memory.transactions.filter((transaction) => transaction.student_id === scope.studentId)
          : memory.transactions;
        return { data: buildMemorySummary(transactions, memory.debts, scope.studentId), error: null };
      }

      const { data, error } = await client.rpc('get_cash_summary', { p_student_id: scope.studentId });
      if (error) return { data: null, error };
      const summary = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      return {
        data: summary
          ? {
              saldoUtama: Number(summary.saldoUtama ?? 0),
              totalPemasukan: Number(summary.totalPemasukan ?? 0),
              totalPengeluaran: Number(summary.totalPengeluaran ?? 0),
              totalTunggakanSiswa: Number(summary.totalTunggakanSiswa ?? 0),
            }
          : emptySummary(),
        error: null,
      };
    },

    async listTransactions(query, scope) {
      const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20));
      if (!client) {
        let transactions = memory.transactions.map((transaction) => hydrateMemoryTransaction(transaction, memory.students));
        if (scope.studentId) transactions = transactions.filter((transaction) => transaction.student_id === scope.studentId);
        if (query.tipe === 'masuk') transactions = transactions.filter((transaction) => transaction.type !== 'pengeluaran');
        if (query.tipe === 'keluar') transactions = transactions.filter((transaction) => transaction.type === 'pengeluaran');
        const search = query.search ? query.search.trim().toLowerCase() : '';
        if (search) transactions = transactions.filter((transaction) => String(transaction.keterangan || '').toLowerCase().includes(search));
        if (query.tanggal_mulai) transactions = transactions.filter((transaction) => transaction.tanggal >= query.tanggal_mulai!);
        if (query.tanggal_selesai) transactions = transactions.filter((transaction) => transaction.tanggal < query.tanggal_selesai!);
        const paymentMethod = query.metode_pembayaran ? normalizePaymentMethodCode(query.metode_pembayaran) : null;
        if (paymentMethod) transactions = transactions.filter((transaction) => (transaction.payment_method_code || 'cash') === paymentMethod);
        transactions.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.created_at.localeCompare(a.created_at));
        const count = transactions.length;
        return { data: transactions.slice((page - 1) * pageSize, page * pageSize), count, error: null };
      }

      let dbQuery = client.from('cash_transactions').select(TRANSACTION_SELECT, { count: 'exact' });
      if (query.tipe === 'masuk') dbQuery = dbQuery.in('type', ['iuran_wajib', 'pemasukan']);
      if (query.tipe === 'keluar') dbQuery = dbQuery.eq('type', 'pengeluaran');
      const search = query.search ? sanitizeSearch(query.search) : '';
      if (search) dbQuery = dbQuery.ilike('keterangan', `%${search}%`);
      if (query.tanggal_mulai) dbQuery = dbQuery.gte('tanggal', query.tanggal_mulai);
      if (query.tanggal_selesai) dbQuery = dbQuery.lt('tanggal', query.tanggal_selesai);

      if (query.metode_pembayaran) {
        const paymentMethod = normalizePaymentMethodCode(query.metode_pembayaran);
        if (!paymentMethod) return { data: [], count: 0, error: { code: 'INVALID_PAYMENT_METHOD', message: 'Metode pembayaran tidak valid.' } };
        const { data: method, error: methodError } = await client.from('cash_payment_methods').select('id').eq('code', paymentMethod).maybeSingle();
        if (methodError) return { data: [], count: 0, error: methodError };
        if (!method) return { data: [], count: 0, error: null };
        dbQuery = paymentMethod === 'cash'
          ? dbQuery.or(`payment_method_id.eq.${method.id},payment_method_id.is.null`)
          : dbQuery.eq('payment_method_id', method.id);
      }
      if (scope.studentId) dbQuery = dbQuery.eq('student_id', scope.studentId);
      dbQuery = dbQuery.order('tanggal', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false });
      const from = (page - 1) * pageSize;
      const { data, count, error } = await dbQuery.range(from, from + pageSize - 1);
      return { data: (data || []) as CashTransactionRecord[], count: count ?? 0, error: error || null };
    },
  };
}
