import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DashboardMemoryState,
  DashboardRepository,
  DashboardSummary,
  OperationalDashboardSummary,
} from './dashboard.types.js';
import { createDefaultDashboardSummary } from './dashboard.helpers.js';

/** Database-backed member read model with a deterministic local fallback. */
type DatabaseRow = Record<string, unknown>;
type SupabaseLike = SupabaseClient | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asString(value: unknown, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value);
}

function statusCount(rows: DatabaseRow[], status: string): number {
  return rows.filter((row) => asString(row.status).toLowerCase() === status).length;
}

async function readDatabaseSummary(client: SupabaseClient, studentId: string): Promise<{ data: DashboardSummary } | { error: unknown }> {
  const [studentResult, attendanceResult, debtResult, transactionResult, gradeResult] = await Promise.all([
    client.from('students').select('id,nama,nis,kelas,peminatan,foto_url').eq('id', studentId).maybeSingle(),
    client.from('attendance').select('status').eq('student_id', studentId),
    client.from('debt_records').select('amount,status,created_at').eq('student_id', studentId).order('created_at', { ascending: false }),
    client.from('cash_transactions').select('id,type,nominal,keterangan,tanggal,created_at,is_billing').eq('student_id', studentId).eq('type', 'iuran_wajib').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(10),
    client.from('grades').select('id,nilai,keterangan,updated_at,created_at,assignments(title,category,due_date)').eq('student_id', studentId).order('updated_at', { ascending: false }).limit(10),
  ]);
  const failed = [studentResult, attendanceResult, debtResult, transactionResult, gradeResult].find((result) => result.error);
  if (failed?.error) return { error: failed.error };

  const student = (studentResult.data ?? {}) as DatabaseRow;
  const attendanceRows = (attendanceResult.data ?? []) as DatabaseRow[];
  const debtRows = (debtResult.data ?? []) as DatabaseRow[];
  const transactions = (transactionResult.data ?? []) as DatabaseRow[];
  const grades = (gradeResult.data ?? []) as DatabaseRow[];
  const hadir = statusCount(attendanceRows, 'hadir');
  const sakit = statusCount(attendanceRows, 'sakit');
  const izin = statusCount(attendanceRows, 'izin');
  const alpha = statusCount(attendanceRows, 'alpha');
  const totalAttendance = attendanceRows.length;
  const totalTunggakan = debtRows.filter((row) => asString(row.status).toLowerCase() !== 'paid').reduce((sum, row) => sum + asNumber(row.amount), 0);
  const payments = transactions.filter((row) => asNumber(row.nominal) > 0);
  const latestPayment = payments[0];

  return {
    data: {
      studentId,
      profile: {
        nama: asString(student.nama, 'Siswa'),
        nisn: asString(student.nis),
        kelas: asString(student.kelas),
        jurusan: asString(student.peminatan),
        fotoUrl: asString(student.foto_url),
        waliKelas: '',
      },
      attendance: {
        persentase: totalAttendance === 0 ? 0 : (hadir / totalAttendance) * 100,
        hadir, sakit, izin, alpha, total: totalAttendance,
      },
      cash: {
        totalTunggakan,
        totalDibayar: payments.reduce((sum, row) => sum + asNumber(row.nominal), 0),
        jumlahPembayaran: payments.length,
        statusPembayaranTerakhir: latestPayment ? 'tercatat' : (totalTunggakan > 0 ? 'belum lunas' : 'belum ada pembayaran'),
        riwayat: payments.slice(0, 5).map((row) => ({
          id: asString(row.id),
          nominal: asNumber(row.nominal),
          date: asString(row.tanggal ?? row.created_at),
          status: 'lunas',
          keterangan: asString(row.keterangan, 'Pembayaran kas'),
        })),
      },
      grades: {
        rataRata: grades.length === 0 ? 0 : grades.reduce((sum, row) => sum + (({ A: 4, B: 3, C: 2, D: 1, E: 0 } as Record<string, number>)[asString(row.nilai)] ?? 0), 0) / grades.length,
        predikat: asString(grades[0]?.nilai),
        terakhir: grades.slice(0, 5).map((row) => ({
          taskTitle: asString((row.assignments as DatabaseRow | null)?.title, 'Tugas'),
          grade: asString(row.nilai),
          category: asString((row.assignments as DatabaseRow | null)?.category),
          date: asString(row.updated_at ?? row.created_at),
        })),
      },
      activeBorrowings: [],
      contestTasks: [],
    },
  };
}

async function readOperationalDashboardSummary(
  client: SupabaseClient,
): Promise<{ data: OperationalDashboardSummary } | { error: unknown }> {
  const result = await client.rpc('get_operational_dashboard_summary', { p_report_date: null });
  if (result.error) return { error: result.error };

  const summary = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!isRecord(summary)) {
    return { error: new Error('Operational dashboard RPC returned an invalid payload.') };
  }

  return { data: summary as unknown as OperationalDashboardSummary };
}

export function createDashboardRepository(state: DashboardMemoryState, client: SupabaseLike = null): DashboardRepository {
  return {
    async getStudentSummary(studentId) {
      if (client) return readDatabaseSummary(client, studentId);
      const existing = state.summaries.get(studentId);
      if (existing) return { data: { ...existing, studentId } };

      const summary = createDefaultDashboardSummary(studentId);
      state.summaries.set(studentId, summary);
      return { data: { ...summary, studentId } };
    },
    async getOperationalSummary() {
      if (client) return readOperationalDashboardSummary(client);
      return {
        error: new Error('Supabase client is required for the operational dashboard summary.'),
      };
    },
  };
}
