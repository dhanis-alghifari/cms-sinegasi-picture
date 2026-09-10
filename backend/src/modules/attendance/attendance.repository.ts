import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import {
  buildAttendanceClassFilter,
  mapAttendanceRow,
  type AttendanceListRecord,
} from './attendance.helpers.js';

export type AttendanceListQuery = {
  search?: string;
  kelas?: string;
  status?: string;
  tanggal?: string;
  date_from?: string;
  date_to?: string;
  student_id?: string;
  page: number;
  pageSize: number;
};

export type AttendanceSummaryQuery = {
  tanggal?: string;
  date_from?: string;
  date_to?: string;
  student_id?: string;
};

export type AttendanceWriteInput = {
  studentId: string;
  tanggal: string;
  status: string;
  keterangan?: string;
  idempotencyKey: string;
  actorId: string;
};

export type AttendanceRosterQuery = {
  tanggal: string;
  kelas: string;
  page: number;
  pageSize: number;
};

export type AttendanceBatchWriteInput = {
  tanggal: string;
  kelas: string;
  records: Array<{
    student_id: string;
    status: string;
    keterangan?: string;
  }>;
  actorId: string;
  changeReason?: string;
};

export type AttendanceRosterRecord = {
  student_id: string;
  nis: string;
  nama: string;
  kelas: string;
  status?: string;
  keterangan?: string;
};

export type AttendanceCorrectionInput = {
  attendanceId: string;
  status: string;
  keterangan?: string;
  actorId: string;
  changeReason: string;
};

export type AttendanceSummary = {
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  total: number;
};

export type AttendanceRepositoryError = {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: unknown;
} | null;

export interface AttendanceRepository {
  isConfigured(): boolean;
  list(query: AttendanceListQuery): Promise<{ data: AttendanceListRecord[]; count: number; error: AttendanceRepositoryError }>;
  roster(query: AttendanceRosterQuery): Promise<{ data: AttendanceRosterRecord[]; count: number; error: AttendanceRepositoryError }>;
  summary(query: AttendanceSummaryQuery): Promise<{ data: AttendanceSummary | null; error: AttendanceRepositoryError }>;
  record(input: AttendanceWriteInput): Promise<{ data: Record<string, unknown> | null; error: AttendanceRepositoryError }>;
  batchRecord(input: AttendanceBatchWriteInput): Promise<{ data: Record<string, unknown>[]; error: AttendanceRepositoryError }>;
  correct(input: AttendanceCorrectionInput): Promise<{ data: Record<string, unknown> | null; error: AttendanceRepositoryError }>;
}

type SupabaseLike = SupabaseClient | null;

const ATTENDANCE_LIST_SELECT = 'id,student_id,tanggal,status,keterangan,is_locked,idempotency_key,created_by,created_at,updated_by,updated_at,students!inner(id,nis,nama,kelas,peminatan)';
const ATTENDANCE_RECORD_SELECT = 'id,student_id,tanggal,status,keterangan,is_locked,idempotency_key,created_by,created_at,updated_by,updated_at,students!inner(id,nis,nama,kelas,peminatan)';
const ATTENDANCE_ROSTER_STUDENT_SELECT = 'id,nis,nama,kelas';

function sanitizeSearch(value: string): string {
  return value.trim().replace(/[%,_()]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

function isMissingSummaryFunction(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (
    ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code || '')
    || error.message?.includes('get_attendance_summary')
  ));
}

function countSummaryRows(rows: Array<{ status?: string }>): AttendanceSummary {
  const summary = rows.reduce<AttendanceSummary>((result, row) => {
    const status = row.status;
    if (status === 'hadir') result.hadir += 1;
    if (status === 'sakit') result.sakit += 1;
    if (status === 'izin') result.izin += 1;
    if (status === 'alpha') result.alpha += 1;
    result.total += 1;
    return result;
  }, { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 });
  return summary;
}

export function createAttendanceRepository(client: SupabaseLike): AttendanceRepository {
  return {
    isConfigured: () => client !== null,

    async list(query) {
      if (!client) return { data: [], count: 0, error: null };

      let dbQuery = client.from('attendance').select(ATTENDANCE_LIST_SELECT, { count: 'exact' });
      if (query.tanggal) dbQuery = dbQuery.eq('tanggal', query.tanggal);
      if (query.date_from) dbQuery = dbQuery.gte('tanggal', query.date_from);
      if (query.date_to) dbQuery = dbQuery.lte('tanggal', query.date_to);
      if (query.student_id) dbQuery = dbQuery.eq('student_id', query.student_id);
      if (query.status && query.status !== 'all') dbQuery = dbQuery.eq('status', query.status);

      const search = query.search ? sanitizeSearch(query.search) : '';
      if (search) {
        dbQuery = dbQuery.or(`nama.ilike.%${search}%,nis.ilike.%${search}%`, { referencedTable: 'students' });
      }
      if (query.kelas && query.kelas !== 'all') {
        const classFilter = buildAttendanceClassFilter(query.kelas);
        dbQuery = classFilter.kind === 'level'
          ? dbQuery.or(classFilter.expression, { referencedTable: 'students' })
          : dbQuery.eq('students.kelas', classFilter.value);
      }

      const from = (query.page - 1) * query.pageSize;
      const to = from + query.pageSize - 1;
      dbQuery = dbQuery.order('tanggal', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      const { data, count, error } = await dbQuery;
      const rows = Array.isArray(data) ? data as DatabaseRow[] : [];
      return { data: rows.map(mapAttendanceRow), count: count ?? 0, error: error || null };
    },

    async roster(query) {
      if (!client) return { data: [], count: 0, error: null };

      let studentsQuery = client
        .from('students')
        .select(ATTENDANCE_ROSTER_STUDENT_SELECT, { count: 'exact' })
        .eq('is_active', true);
      const classFilter = buildAttendanceClassFilter(query.kelas);
      if (classFilter.kind === 'level') {
        studentsQuery = studentsQuery.or(classFilter.expression);
      } else {
        studentsQuery = studentsQuery.eq('kelas', classFilter.value);
      }

      const from = (query.page - 1) * query.pageSize;
      const to = from + query.pageSize - 1;
      const studentsResult = await studentsQuery
        .order('nama', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (studentsResult.error) return { data: [], count: 0, error: studentsResult.error };

      const students = (studentsResult.data || []) as Array<Record<string, unknown>>;
      if (students.length === 0) return { data: [], count: studentsResult.count ?? 0, error: null };
      const studentIds = students.map((student) => String(student.id));
      const attendanceResult = await client
        .from('attendance')
        .select('student_id,status,keterangan')
        .eq('tanggal', query.tanggal)
        .in('student_id', studentIds);
      if (attendanceResult.error) return { data: [], count: 0, error: attendanceResult.error };

      const attendanceByStudent = new Map(
        ((attendanceResult.data || []) as Array<Record<string, unknown>>)
          .map((row) => [String(row.student_id), row]),
      );
      const data = students.map((student) => {
        const attendance = attendanceByStudent.get(String(student.id));
        return {
          student_id: String(student.id),
          nis: String(student.nis || ''),
          nama: String(student.nama || ''),
          kelas: String(student.kelas || ''),
          ...(attendance?.status == null ? {} : { status: String(attendance.status) }),
          ...(attendance?.keterangan == null ? {} : { keterangan: String(attendance.keterangan) }),
        };
      });
      return { data, count: studentsResult.count ?? data.length, error: null };
    },

    async summary(query) {
      if (!client) return { data: { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 }, error: null };

      const dateFrom = query.tanggal || query.date_from || null;
      const dateTo = query.tanggal || query.date_to || null;

      // The SQL function performs COUNT/FILTER in PostgreSQL, so the API does
      // not transfer every attendance row for a high-volume school date or
      // historical student report.
      const aggregate = await client.rpc('get_attendance_summary_filtered', {
        p_student_id: query.student_id || null,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (!aggregate.error && aggregate.data) {
        const row = Array.isArray(aggregate.data) ? aggregate.data[0] : aggregate.data;
        if (row) {
          return {
            data: {
              hadir: Number(row.hadir || 0),
              sakit: Number(row.sakit || 0),
              izin: Number(row.izin || 0),
              alpha: Number(row.alpha || 0),
              total: Number(row.total || 0),
            },
            error: null,
          };
        }
      }

      // During rollout, tolerate a database that has not received migration
      // 058 yet. This fallback is correct, but the migration is required for
      // production-scale aggregate performance.
      if (!isMissingSummaryFunction(aggregate.error)) {
        return { data: null, error: aggregate.error || { message: 'Ringkasan presensi tidak tersedia.' } };
      }
      let fallbackQuery = client.from('attendance').select('status');
      if (query.student_id) fallbackQuery = fallbackQuery.eq('student_id', query.student_id);
      if (dateFrom) fallbackQuery = fallbackQuery.gte('tanggal', dateFrom);
      if (dateTo) fallbackQuery = fallbackQuery.lte('tanggal', dateTo);
      const fallback = await fallbackQuery;
      return {
        data: fallback.error ? null : countSummaryRows((fallback.data || []) as Array<{ status?: string }>),
        error: fallback.error || null,
      };
    },

    async record(input) {
      if (!client) {
        return {
          data: {
            id: `att-${Date.now()}`,
            student_id: input.studentId,
            tanggal: input.tanggal,
            status: input.status,
            keterangan: input.keterangan,
            idempotency_key: input.idempotencyKey,
          },
          error: null,
        };
      }
      const { data, error } = await client.from('attendance').upsert([{
        student_id: input.studentId,
        tanggal: input.tanggal,
        status: input.status,
        keterangan: input.keterangan,
        idempotency_key: input.idempotencyKey,
        created_by: input.actorId,
        updated_by: input.actorId,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'idempotency_key' }).select(ATTENDANCE_RECORD_SELECT).single();
      return {
        data: data ? mapAttendanceRow(data as DatabaseRow) : null,
        error: error || null,
      };
    },

    async batchRecord(input) {
      if (!client) {
        return {
          data: input.records.map((record, index) => ({
            id: `att-${Date.now()}-${index}`,
            student_id: record.student_id,
            tanggal: input.tanggal,
            status: record.status,
            keterangan: record.keterangan,
            idempotency_key: `att-${record.student_id}-${input.tanggal}`,
          })),
          error: null,
        };
      }

      const result = await client.rpc('record_attendance_batch_atomic', {
        p_tanggal: input.tanggal,
        p_kelas: input.kelas,
        p_records: input.records,
        p_actor_id: input.actorId,
        p_change_reason: input.changeReason?.trim() || 'Mencatat absensi massal',
      });
      if (result.error) return { data: [], error: result.error };
      const payload = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown> | null;
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      return { data: rows as Record<string, unknown>[], error: null };
    },

    async correct(input) {
      if (!client) return { data: null, error: { code: 'NOT_FOUND', message: 'Record absensi tidak ditemukan.' } };
      const { data: rpcData, error } = await client.rpc('correct_attendance_atomic', {
        p_attendance_id: input.attendanceId,
        p_status: input.status,
        p_keterangan: input.keterangan?.trim() || null,
        p_actor_id: input.actorId,
        p_change_reason: input.changeReason,
      });
      const payload = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const data = payload && typeof payload === 'object'
        ? mapAttendanceRow(payload as DatabaseRow)
        : null;
      return {
        data,
        error: error || null,
      };
    },
  };
}
