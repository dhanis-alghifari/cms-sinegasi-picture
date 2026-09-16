import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildAttendanceClassFilter,
  mapAttendanceRow,
  type AttendanceListRecord,
} from './attendance.helpers.js';
import type {
  AttendanceListQuery,
  AttendanceReadRepository,
  AttendanceRepositoryError,
  AttendanceRosterQuery,
  AttendanceRosterRecord,
  AttendanceSummaryQuery,
} from './attendance.repository.js';
import {
  ATTENDANCE_LIST_SELECT,
  ATTENDANCE_ROSTER_STUDENT_SELECT,
  toDatabaseRows,
  emptyAttendanceSummary,
  isMissingSummaryFunction,
  sanitizeAttendanceSearch,
} from './attendance.repository.shared.js';

type SupabaseLike = SupabaseClient | null;

export function createAttendanceReadRepository(client: SupabaseLike): AttendanceReadRepository {
  return {
    async list(query: AttendanceListQuery): Promise<{ data: AttendanceListRecord[]; count: number; error: AttendanceRepositoryError }> {
      if (!client) return { data: [], count: 0, error: null };

      let dbQuery = client.from('attendance').select(ATTENDANCE_LIST_SELECT, { count: 'exact' });
      if (query.tanggal) dbQuery = dbQuery.eq('tanggal', query.tanggal);
      if (query.date_from) dbQuery = dbQuery.gte('tanggal', query.date_from);
      if (query.date_to) dbQuery = dbQuery.lte('tanggal', query.date_to);
      if (query.student_id) dbQuery = dbQuery.eq('student_id', query.student_id);
      if (query.status && query.status !== 'all') dbQuery = dbQuery.eq('status', query.status);

      const search = query.search ? sanitizeAttendanceSearch(query.search) : '';
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
      return { data: toDatabaseRows(data).map(mapAttendanceRow), count: count ?? 0, error: error || null };
    },

    async roster(query: AttendanceRosterQuery): Promise<{ data: AttendanceRosterRecord[]; count: number; error: AttendanceRepositoryError }> {
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

      const students = toDatabaseRows(studentsResult.data);
      if (students.length === 0) return { data: [], count: studentsResult.count ?? 0, error: null };
      const studentIds = students.map((student) => String(student.id));
      const attendanceResult = await client
        .from('attendance')
        .select('student_id,status,keterangan')
        .eq('tanggal', query.tanggal)
        .in('student_id', studentIds);
      if (attendanceResult.error) return { data: [], count: 0, error: attendanceResult.error };

      const attendanceByStudent = new Map(
        toDatabaseRows(attendanceResult.data)
          .map((row) => [String(row.student_id), row]),
      );
      const data = students.map((student) => {
        const attendance = attendanceByStudent.get(String(student.id));
        return {
          student_id: String(student.id),
          nis: String(student.nis || ''),
          nama: String(student.nama || ''),
          kelas: String(student.kelas || ''),
          ...(attendance?.status === null || attendance?.status === undefined ? {} : { status: String(attendance.status) }),
          ...(attendance?.keterangan === null || attendance?.keterangan === undefined ? {} : { keterangan: String(attendance.keterangan) }),
        };
      });
      return { data, count: studentsResult.count ?? data.length, error: null };
    },

    async summary(query: AttendanceSummaryQuery) {
      if (!client) return { data: emptyAttendanceSummary(), error: null };

      const dateFrom = query.tanggal || query.date_from || null;
      const dateTo = query.tanggal || query.date_to || null;
      const normalizedClass = query.kelas?.trim();
      const classFilter = normalizedClass && normalizedClass !== 'all'
        ? buildAttendanceClassFilter(normalizedClass)
        : null;
      const normalizedStatus = query.status?.trim().toLowerCase();
      const normalizedSearch = query.search ? sanitizeAttendanceSearch(query.search) : '';
      const aggregate = await client.rpc('get_attendance_summary_filtered', {
        p_student_id: query.student_id || null,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_kelas: normalizedClass && normalizedClass !== 'all' ? normalizedClass : null,
        p_status: normalizedStatus && normalizedStatus !== 'all' ? normalizedStatus : null,
        p_search: normalizedSearch || null,
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

      if (!isMissingSummaryFunction(aggregate.error)) {
        return { data: null, error: aggregate.error || { message: 'Ringkasan presensi tidak tersedia.' } };
      }
      const statuses = ['hadir', 'sakit', 'izin', 'alpha'] as const;
      const countResults = await Promise.all(statuses.map((status) => {
        let fallbackQuery = client.from('attendance').select('id', { count: 'exact', head: true }).eq('status', status);
        if (query.student_id) fallbackQuery = fallbackQuery.eq('student_id', query.student_id);
        if (dateFrom) fallbackQuery = fallbackQuery.gte('tanggal', dateFrom);
        if (dateTo) fallbackQuery = fallbackQuery.lte('tanggal', dateTo);
        if (normalizedStatus && normalizedStatus !== 'all') fallbackQuery = fallbackQuery.eq('status', normalizedStatus);
        if (classFilter) {
          fallbackQuery = classFilter.kind === 'level'
            ? fallbackQuery.or(classFilter.expression, { referencedTable: 'students' })
            : fallbackQuery.eq('students.kelas', classFilter.value);
        }
        if (normalizedSearch) {
          fallbackQuery = fallbackQuery.or(`nama.ilike.%${normalizedSearch}%,nis.ilike.%${normalizedSearch}%`, { referencedTable: 'students' });
        }
        return fallbackQuery;
      }));
      const fallbackError = countResults.find((result) => result.error);
      if (fallbackError?.error) return { data: null, error: fallbackError.error };
      const [hadir, sakit, izin, alpha] = countResults.map((result) => result.count ?? 0);
      return { data: { hadir, sakit, izin, alpha, total: hadir + sakit + izin + alpha }, error: null };
    },
  };
}
