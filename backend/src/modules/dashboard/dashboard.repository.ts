import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DashboardMemoryState,
  DashboardRepository,
  DashboardSummary,
  OperationalDashboardSummary,
} from './dashboard.types.js';

/** Database-backed member read model. */
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

function paymentStatus(hasLatestPayment: boolean, totalTunggakan: number): string {
  if (hasLatestPayment) return 'tercatat';
  if (totalTunggakan > 0) return 'belum lunas';
  return 'belum ada pembayaran';
}

type AttendanceSummary = {
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  total: number;
};

const attendanceStatuses = ['hadir', 'sakit', 'izin', 'alpha'] as const;

function parseAttendanceSummary(value: unknown): AttendanceSummary | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) return null;
  return {
    hadir: asNumber(row.hadir),
    sakit: asNumber(row.sakit),
    izin: asNumber(row.izin),
    alpha: asNumber(row.alpha),
    total: asNumber(row.total),
  };
}

function isMissingAttendanceSummaryFunction(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(code)
    || message.includes('get_attendance_summary_filtered');
}

type AttendanceSummaryResult =
  | { data: AttendanceSummary; error?: never }
  | { data?: never; error: unknown };

async function readAttendanceSummary(client: SupabaseClient, studentId: string): Promise<AttendanceSummaryResult> {
  const aggregate = await client.rpc('get_attendance_summary_filtered', {
    p_student_id: studentId,
    p_date_from: null,
    p_date_to: null,
    p_kelas: null,
    p_status: null,
    p_search: null,
  });
  if (!aggregate.error) {
    const summary = parseAttendanceSummary(aggregate.data);
    if (summary) return { data: summary };
    return { error: new Error('Attendance summary RPC returned an invalid payload.') };
  }
  if (!isMissingAttendanceSummaryFunction(aggregate.error)) return { error: aggregate.error };

  const countResults = await Promise.all(attendanceStatuses.map((status) => (
    client.from('attendance').select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', status)
  )));
  const failed = countResults.find((result) => result.error);
  if (failed?.error) return { error: failed.error };
  const counts = countResults.map((result) => result.count ?? 0);
  const [hadir, sakit, izin, alpha] = counts;
  return { data: { hadir, sakit, izin, alpha, total: counts.reduce((sum, count) => sum + count, 0) } };
}

async function readDatabaseSummary(client: SupabaseClient, studentId: string): Promise<{ data: DashboardSummary } | { error: unknown }> {
  const [studentResult, attendanceResult, transactionResult, gradeResult] = await Promise.all([
    client.from('v_student_dashboard_summary').select('student_id,nama,nis,kelas,peminatan,foto_url,total_tunggakan').eq('student_id', studentId).maybeSingle(),
    readAttendanceSummary(client, studentId),
    client.from('cash_transactions').select('id,type,nominal,keterangan,tanggal,created_at,is_billing').eq('student_id', studentId).eq('type', 'iuran_wajib').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(10),
    client.from('grades').select('id,nilai,keterangan,updated_at,created_at,assignments(title,category,due_date)').eq('student_id', studentId).order('updated_at', { ascending: false }).limit(10),
  ]);
  const failed = [studentResult, attendanceResult, transactionResult, gradeResult].find((result) => 'error' in result && result.error);
  if (failed && 'error' in failed && failed.error) return { error: failed.error };
  if ('error' in attendanceResult) return { error: attendanceResult.error };

  const student = (studentResult.data ?? {}) as DatabaseRow;
  const attendance = attendanceResult.data;
  const transactions = (transactionResult.data ?? []) as DatabaseRow[];
  const grades = (gradeResult.data ?? []) as DatabaseRow[];
  const totalTunggakan = asNumber(student.total_tunggakan);
  const totalAttendance = attendance.total;
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
        persentase: totalAttendance === 0 ? 0 : (attendance.hadir / totalAttendance) * 100,
        hadir: attendance.hadir,
        sakit: attendance.sakit,
        izin: attendance.izin,
        alpha: attendance.alpha,
        total: totalAttendance,
      },
      cash: {
        totalTunggakan,
        totalDibayar: payments.reduce((sum, row) => sum + asNumber(row.nominal), 0),
        jumlahPembayaran: payments.length,
        statusPembayaranTerakhir: paymentStatus(Boolean(latestPayment), totalTunggakan),
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
      return {
        error: new Error('Supabase client or an explicit test summary is required for the personal dashboard.'),
      };
    },
    async getOperationalSummary() {
      if (client) return readOperationalDashboardSummary(client);
      return {
        error: new Error('Supabase client is required for the operational dashboard summary.'),
      };
    },
  };
}
