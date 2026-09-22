import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseError } from '../../shared/database/database.types.js';
import { mapAssignmentRow, mapGradeRow, matchesClassFilter } from './grades.helpers.js';
import type {
  AssignmentListQuery, AssignmentRecord, BulkGradeItem, CreateAssignmentInput, GradeDistribution, GradeListQuery,
  CreatePklPeriodInput, CreateReportPeriodInput, GradeRecord, GradeReport, GradeReportPeriod, GradeReportQuery,
  GradeSummary, ReviewPklPeriodInput, StudentGradeSummary, StudentPklPeriod,
} from './grades.types.js';
import { calculateGradeReport, type ReportAttendanceEvidence, type ReportGradeEvidence } from './grades.reports.js';

type SupabaseLike = SupabaseClient | null;
export type GradesMemoryState = {
  grades: GradeRecord[];
  assignments: AssignmentRecord[];
  reportPeriods?: GradeReportPeriod[];
  reports?: GradeReport[];
  pklPeriods?: StudentPklPeriod[];
};
const FILTER_LOOKUP_LIMIT = 5_000;
export interface GradesRepository {
  isConfigured(): boolean;
  listGrades(query: GradeListQuery): Promise<{ data: { data: GradeRecord[]; total: number; page: number; pageSize: number; totalPages: number } | null; error: DatabaseError | null }>;
  listAssignments(query: AssignmentListQuery): Promise<{ data: { data: AssignmentRecord[]; total: number; page: number; pageSize: number; totalPages: number } | null; error: DatabaseError | null }>;
  summary(query: GradeListQuery): Promise<{ data: GradeSummary | null; error: DatabaseError | null }>;
  createAssignment(input: { title: string; category: string; description: string | null; categoryDescription: string | null; kelas: string | null; dueDate: string; actorId: string | null }): Promise<{ data: AssignmentRecord | null; error: DatabaseError | null }>;
  bulkGrade(input: { assignmentId: string; grades: BulkGradeItem[]; actorId: string; changeReason: string }): Promise<{ data: unknown; error: DatabaseError | null }>;
  distribution(query: { category?: string; kelas?: string; periode?: string }): Promise<{ data: { filters: Record<string, string>; totalAssignments: number; data: GradeDistribution[] } | null; error: DatabaseError | null }>;
  studentSummary(): Promise<{ data: StudentGradeSummary[] | null; error: DatabaseError | null }>;
  listReportPeriods(): Promise<{ data: GradeReportPeriod[] | null; error: DatabaseError | null }>;
  createReportPeriod(input: CreateReportPeriodInput): Promise<{ data: GradeReportPeriod | null; error: DatabaseError | null }>;
  listReports(query: GradeReportQuery): Promise<{ data: GradeReport[] | null; error: DatabaseError | null }>;
  generateReports(input: { periodId: string; actorId: string }): Promise<{ data: GradeReport[] | null; error: DatabaseError | null }>;
  approveReports(input: { periodId: string; actorId: string }): Promise<{ data: GradeReport[] | null; error: DatabaseError | null }>;
  listPklPeriods(query: { studentId?: string; kelas?: string }): Promise<{ data: StudentPklPeriod[] | null; error: DatabaseError | null }>;
  createPklPeriod(input: CreatePklPeriodInput): Promise<{ data: StudentPklPeriod | null; error: DatabaseError | null }>;
  reviewPklPeriod(input: ReviewPklPeriodInput): Promise<{ data: StudentPklPeriod | null; error: DatabaseError | null }>;
}

const GRADE_SELECT = 'id,assignment_id,student_id,nilai,status,keterangan,graded_by,created_by,updated_by,created_at,updated_at,students(id,nis,nama,kelas,peminatan),assignments(id,title,category,due_date)';
const DISTRIBUTIONS: GradeDistribution[] = [
  { assignmentId: 'asg-001', assignmentTitle: 'Sinematografi Dasar & Lighting Lab', category: 'class_task', dueDate: '2026-07-25', kelas: 'XII DKV 1', distribution: { A: 8, B: 6, C: 3, D: 1, E: 0 }, totalGraded: 18, percentageA: 44.4 },
  { assignmentId: 'asg-002', assignmentTitle: 'Produksi Short Film "Bayangan Masa"', category: 'crew_film', dueDate: '2026-08-01', kelas: 'XII DKV 1', distribution: { A: 5, B: 4, C: 2, D: 1, E: 0 }, totalGraded: 12, percentageA: 41.7 },
  { assignmentId: 'asg-003', assignmentTitle: 'Dokumentasi Special Event HUT Sekolah', category: 'event_participation', dueDate: '2026-07-15', kelas: 'XI DKV 1', distribution: { A: 3, B: 3, C: 2, D: 0, E: 0 }, totalGraded: 8, percentageA: 37.5 },
];
const STUDENT_SUMMARY: StudentGradeSummary[] = [
  { studentId: 'std-001', nama: 'Budi Santoso', kelas: 'XII DKV 1', peminatan: 'kamera', predikatA: 4, predikatB: 2, predikatC: 0, predikatDominan: 'A' },
  { studentId: 'std-002', nama: 'Siti Aminah', kelas: 'XII DKV 1', peminatan: 'editing', predikatA: 2, predikatB: 4, predikatC: 1, predikatDominan: 'B' },
  { studentId: 'std-003', nama: 'Rizky Pratama', kelas: 'XII DKV 2', peminatan: 'naskah', predikatA: 1, predikatB: 2, predikatC: 3, predikatDominan: 'C' },
];
const GRADE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function pageValues(query: { page?: string; pageSize?: string }, defaultPageSize = 20) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || String(defaultPageSize), 10) || defaultPageSize));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

function emptyPage(page: number, pageSize: number) {
  return { data: [], total: 0, page, pageSize, totalPages: 1 };
}

function normalizeSearch(value: string | undefined): string | undefined {
  const search = value?.trim().replace(/[^a-zA-Z0-9À-ÿ -]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
  return search || undefined;
}

function uniqueIds(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function assignmentTargets(studentClass: string): string[] {
  const normalized = studentClass.trim();
  const level = normalized.split(/\s+/)[0];
  return uniqueIds([normalized, level, 'Semua']);
}

const REPORT_PERIOD_SELECT = 'id,academic_year,semester,start_date,end_date,status,created_by,approved_by,approved_at,created_at,updated_at';
const PKL_SELECT = 'id,student_id,start_date,end_date,institution,notes,status,requested_by,reviewed_by,reviewed_at,created_at,updated_at,students(id,nis,nama,kelas)';
const REPORT_SELECT = 'id,period_id,student_id,predikat,status,deskripsi,evidence_count,hadir_count,sakit_count,izin_count,alpha_count,pkl_days,attendance_percentage,generated_at,approved_by,approved_at,updated_by,created_at,updated_at,students(id,nis,nama,kelas)';

function databaseRow(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function mapReportPeriod(row: Record<string, unknown>): GradeReportPeriod {
  return {
    id: String(row.id ?? ''), academic_year: String(row.academic_year ?? ''), semester: String(row.semester ?? 'ganjil') as GradeReportPeriod['semester'],
    start_date: String(row.start_date ?? ''), end_date: String(row.end_date ?? ''), status: String(row.status ?? 'draft') as GradeReportPeriod['status'],
    created_by: row.created_by == null ? undefined : String(row.created_by), approved_by: row.approved_by == null ? undefined : String(row.approved_by),
    approved_at: row.approved_at == null ? undefined : String(row.approved_at), created_at: String(row.created_at ?? ''), updated_at: String(row.updated_at ?? row.created_at ?? ''),
  };
}

function mapPklPeriod(row: Record<string, unknown>): StudentPklPeriod {
  const student = databaseRow(row.students);
  return {
    id: String(row.id ?? ''), student_id: String(row.student_id ?? ''), start_date: String(row.start_date ?? ''), end_date: String(row.end_date ?? ''),
    institution: String(row.institution ?? ''), notes: row.notes == null ? undefined : String(row.notes), status: String(row.status ?? 'pending') as StudentPklPeriod['status'],
    requested_by: row.requested_by == null ? undefined : String(row.requested_by), reviewed_by: row.reviewed_by == null ? undefined : String(row.reviewed_by),
    reviewed_at: row.reviewed_at == null ? undefined : String(row.reviewed_at), created_at: String(row.created_at ?? ''), updated_at: String(row.updated_at ?? row.created_at ?? ''),
    student_nis: student.nis == null ? undefined : String(student.nis), student_nama: student.nama == null ? undefined : String(student.nama), kelas: student.kelas == null ? undefined : String(student.kelas),
  };
}

function mapGradeReport(row: Record<string, unknown>): GradeReport {
  const student = databaseRow(row.students);
  return {
    id: String(row.id ?? ''), period_id: String(row.period_id ?? ''), student_id: String(row.student_id ?? ''),
    predikat: row.predikat == null ? undefined : String(row.predikat) as GradeReport['predikat'], status: String(row.status ?? 'draft') as GradeReport['status'],
    deskripsi: String(row.deskripsi ?? ''), evidence_count: Number(row.evidence_count ?? 0), hadir_count: Number(row.hadir_count ?? 0),
    sakit_count: Number(row.sakit_count ?? 0), izin_count: Number(row.izin_count ?? 0), alpha_count: Number(row.alpha_count ?? 0), pkl_days: Number(row.pkl_days ?? 0),
    attendance_percentage: row.attendance_percentage == null ? undefined : Number(row.attendance_percentage), generated_at: String(row.generated_at ?? ''),
    approved_by: row.approved_by == null ? undefined : String(row.approved_by), approved_at: row.approved_at == null ? undefined : String(row.approved_at),
    updated_by: row.updated_by == null ? undefined : String(row.updated_by), created_at: String(row.created_at ?? ''), updated_at: String(row.updated_at ?? row.created_at ?? ''),
    student_nis: student.nis == null ? undefined : String(student.nis), student_nama: student.nama == null ? undefined : String(student.nama), kelas: student.kelas == null ? undefined : String(student.kelas),
  };
}

function memoryArrays(state: GradesMemoryState) {
  state.reportPeriods ??= [];
  state.reports ??= [];
  state.pklPeriods ??= [];
  return { reportPeriods: state.reportPeriods, reports: state.reports, pklPeriods: state.pklPeriods };
}

export function createGradesRepository(client: SupabaseLike, state: GradesMemoryState): GradesRepository {
  return {
    isConfigured: () => client !== null,
    async listGrades(query) {
      const { page, pageSize, from, to } = pageValues(query, 50);
      if (!client) {
        let rows = [...state.grades];
        if (query.assignment_id) rows = rows.filter((row) => row.assignment_id === query.assignment_id);
        if (query.student_id) rows = rows.filter((row) => row.student_id === query.student_id);
        if (query.category && query.category !== 'all') rows = rows.filter((row) => row.assignment_category === query.category);
        if (query.kelas && query.kelas !== 'all' && query.scope !== 'own') rows = rows.filter((row) => matchesClassFilter(row.kelas, query.kelas!));
        const search = normalizeSearch(query.search)?.toLowerCase();
        if (search) {
          rows = rows.filter((row) => {
            const fields = query.scope === 'own'
              ? [row.assignment_title]
              : [row.student_nama, row.student_nis, row.assignment_title];
            return fields.some((value) => String(value || '').toLowerCase().includes(search));
          });
        }
        rows.sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)) || b.id.localeCompare(a.id));
        const total = rows.length;
        return { data: { data: rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
      }
      const search = normalizeSearch(query.search);
      let categoryAssignmentIds: string[] | undefined;
      if (query.category && query.category !== 'all') {
        const assignmentQuery = client.from('assignments').select('id').eq('category', query.category);
        const assignmentResult = await assignmentQuery.limit(FILTER_LOOKUP_LIMIT);
        if (assignmentResult.error) return { data: null, error: assignmentResult.error };
        categoryAssignmentIds = uniqueIds((assignmentResult.data || []).map((row) => row.id));
        if (categoryAssignmentIds.length === 0) return { data: emptyPage(page, pageSize), error: null };
      }

      let searchAssignmentIds: string[] | undefined;
      if (search) {
        const assignmentResult = await client.from('assignments').select('id').or(`title.ilike.%${search}%,deskripsi.ilike.%${search}%`).limit(FILTER_LOOKUP_LIMIT);
        if (assignmentResult.error) return { data: null, error: assignmentResult.error };
        searchAssignmentIds = uniqueIds((assignmentResult.data || []).map((row) => row.id));
      }

      let classStudentIds: string[] | undefined;
      if (query.kelas && query.kelas !== 'all' && query.scope !== 'own') {
        const studentResult = await client.from('students').select('id').eq('is_active', true).or(`kelas.eq.${query.kelas},kelas.ilike.${query.kelas} %`).limit(FILTER_LOOKUP_LIMIT);
        if (studentResult.error) return { data: null, error: studentResult.error };
        classStudentIds = uniqueIds((studentResult.data || []).map((row) => row.id));
        if (classStudentIds.length === 0) return { data: emptyPage(page, pageSize), error: null };
      }

      let searchStudentIds: string[] | undefined;
      if (search && query.scope !== 'own') {
        const studentResult = await client.from('students').select('id').eq('is_active', true).or(`nama.ilike.%${search}%,nis.ilike.%${search}%`).limit(FILTER_LOOKUP_LIMIT);
        if (studentResult.error) return { data: null, error: studentResult.error };
        searchStudentIds = uniqueIds((studentResult.data || []).map((row) => row.id));
      }

      if (search && (searchAssignmentIds?.length ?? 0) === 0 && (searchStudentIds?.length ?? 0) === 0) {
        return { data: emptyPage(page, pageSize), error: null };
      }

      let dbQuery = client.from('grades').select(GRADE_SELECT, { count: 'exact' });
      if (query.assignment_id) dbQuery = dbQuery.eq('assignment_id', query.assignment_id);
      if (query.student_id) dbQuery = dbQuery.eq('student_id', query.student_id);
      if (categoryAssignmentIds) dbQuery = dbQuery.in('assignment_id', categoryAssignmentIds);
      if (classStudentIds) dbQuery = dbQuery.in('student_id', classStudentIds);
      if (search) {
        const terms: string[] = [];
        if (searchAssignmentIds?.length) terms.push(`assignment_id.in.(${searchAssignmentIds.join(',')})`);
        if (searchStudentIds?.length) terms.push(`student_id.in.(${searchStudentIds.join(',')})`);
        if (terms.length > 0) dbQuery = dbQuery.or(terms.join(','));
      }
      dbQuery = dbQuery.order('updated_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
      const result = await dbQuery;
      if (result.error) return { data: null, error: result.error };
      const rows: GradeRecord[] = (result.data || []).map((row) => mapGradeRow(row as Record<string, unknown>));
      const total = result.count ?? rows.length;
      return { data: { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
    },
    async listAssignments(query) {
      const { page, pageSize, from, to } = pageValues(query, 10);
      if (!client) {
        let rows = [...state.assignments];
        if (query.category && query.category !== 'all') rows = rows.filter((row) => row.category === query.category);
        if (query.student_id) {
          const studentClass = state.grades.find((grade) => grade.student_id === query.student_id)?.kelas;
          if (!studentClass) return { data: emptyPage(page, pageSize), error: null };
          const targets = assignmentTargets(studentClass);
          rows = rows.filter((row) => !row.kelas || targets.includes(row.kelas));
        } else if (query.kelas && query.kelas !== 'all') {
          rows = rows.filter((row) => row.kelas === query.kelas || row.kelas === 'Semua');
        }
        const search = normalizeSearch(query.search)?.toLowerCase();
        if (search) rows = rows.filter((row) => `${row.title} ${row.description || ''}`.toLowerCase().includes(search));
        rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id));
        const total = rows.length;
        return { data: { data: rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
      }
      let dbQuery = client.from('assignments').select('id,title,category,deskripsi,keterangan_kategori,kelas,due_date,created_by,updated_by,updated_at,created_at', { count: 'exact' });
      if (query.category && query.category !== 'all') dbQuery = dbQuery.eq('category', query.category);
      if (query.student_id) {
        const studentResult = await client.from('students').select('kelas').eq('id', query.student_id).eq('is_active', true).maybeSingle();
        if (studentResult.error) return { data: null, error: studentResult.error };
        if (!studentResult.data?.kelas) return { data: emptyPage(page, pageSize), error: null };
        const targets = assignmentTargets(String(studentResult.data.kelas));
        dbQuery = dbQuery.or(`kelas.is.null,kelas.in.(${targets.join(',')})`);
      } else if (query.kelas && query.kelas !== 'all' && ['X', 'XI', 'XII'].includes(query.kelas)) {
        dbQuery = dbQuery.or(`kelas.is.null,kelas.in.(${query.kelas},Semua)`);
      }
      const search = normalizeSearch(query.search);
      if (search) {
        // Keep one PostgREST OR expression when class scoping is active; the
        // class predicate above remains the authoritative visibility filter.
        dbQuery = dbQuery.ilike('title', `%${search}%`);
      }
      const result = await dbQuery.order('due_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to);
      if (result.error) return { data: null, error: result.error };
      const rows = (result.data || []).map((row) => mapAssignmentRow(row as Record<string, unknown>));
      const total = result.count ?? rows.length;
      return { data: { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
    },
    async summary(query) {
      const counts: GradeSummary['counts'] = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      if (!client) {
        let rows = [...state.grades];
        if (query.student_id) rows = rows.filter((row) => row.student_id === query.student_id);
        if (query.category && query.category !== 'all') rows = rows.filter((row) => row.assignment_category === query.category);
        rows.forEach((row) => { if (row.nilai in counts) counts[row.nilai] += 1; });
        const latest = [...rows].sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))[0];
        return { data: { total: rows.length, counts, latest }, error: null };
      }
      let assignmentIds: string[] | undefined;
      if (query.category && query.category !== 'all') {
        const assignmentResult = await client.from('assignments').select('id').eq('category', query.category).limit(FILTER_LOOKUP_LIMIT);
        if (assignmentResult.error) return { data: null, error: assignmentResult.error };
        assignmentIds = uniqueIds((assignmentResult.data || []).map((row) => row.id));
        if (assignmentIds.length === 0) return { data: { total: 0, counts }, error: null };
      }

      const countResults = await Promise.all(GRADE_LETTERS.map((letter) => {
        let countQuery = client.from('grades').select('id', { count: 'exact', head: true })
          .eq('status', 'graded')
          .eq('nilai', letter);
        if (query.student_id) countQuery = countQuery.eq('student_id', query.student_id);
        if (assignmentIds) countQuery = countQuery.in('assignment_id', assignmentIds);
        return countQuery;
      }));
      const failedCount = countResults.find((result) => result.error);
      if (failedCount?.error) return { data: null, error: failedCount.error };
      GRADE_LETTERS.forEach((letter, index) => { counts[letter] = countResults[index]?.count ?? 0; });

      let latestQuery = client.from('grades').select(GRADE_SELECT).eq('status', 'graded');
      if (query.student_id) latestQuery = latestQuery.eq('student_id', query.student_id);
      if (assignmentIds) latestQuery = latestQuery.in('assignment_id', assignmentIds);
      const latestResult = await latestQuery.order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(1);
      if (latestResult.error) return { data: null, error: latestResult.error };
      const latestRows = (latestResult.data || []).map((row) => mapGradeRow(row as Record<string, unknown>));
      return { data: { total: GRADE_LETTERS.reduce((sum, letter) => sum + counts[letter], 0), counts, latest: latestRows[0] }, error: null };
    },
    async createAssignment(input) {
      if (!client) {
        const record: AssignmentRecord = { id: `asg-${Date.now()}`, title: input.title, category: input.category as AssignmentRecord['category'], description: input.description || input.categoryDescription || undefined, kelas: input.kelas || undefined, date: input.dueDate, created_by: input.actorId || undefined, created_at: new Date().toISOString() };
        state.assignments.unshift(record); return { data: record, error: null };
      }
      const payload = { title: input.title, category: input.category, keterangan_kategori: input.categoryDescription, deskripsi: input.description, kelas: input.kelas, due_date: input.dueDate, ...(input.actorId ? { created_by: input.actorId } : {}) };
      const result = await client.from('assignments').insert([payload]).select('id,title,category,deskripsi,keterangan_kategori,kelas,due_date,created_by,updated_by,updated_at,created_at').single();
      return { data: result.data ? mapAssignmentRow(result.data) : null, error: result.error };
    },
    async bulkGrade(input) {
      if (!client) {
        for (const item of input.grades) {
          const existing = state.grades.find((row) => row.assignment_id === input.assignmentId && row.student_id === item.student_id);
          const record = existing || { id: `grade-${Date.now()}-${item.student_id}`, assignment_id: input.assignmentId, student_id: item.student_id, nilai: item.nilai as GradeRecord['nilai'], graded_by: input.actorId, created_at: new Date().toISOString() } as GradeRecord;
          Object.assign(record, { nilai: item.nilai, keterangan: item.keterangan, graded_by: input.actorId, updated_by: input.actorId, updated_at: new Date().toISOString() });
          if (!existing) state.grades.push(record);
        }
        return { data: input.grades, error: null };
      }
      return client.rpc('record_grades_bulk_atomic', { p_assignment_id: input.assignmentId, p_grades: input.grades, p_graded_by: input.actorId, p_change_reason: input.changeReason });
    },
    async distribution(query) {
      const data = DISTRIBUTIONS.filter((row) => (!query.category || query.category === 'all' || row.category === query.category) && (!query.kelas || query.kelas === 'all' || row.kelas === query.kelas));
      return { data: { filters: { category: query.category || 'all', kelas: query.kelas || 'all', periode: query.periode || 'all' }, totalAssignments: data.length, data }, error: null };
    },
    async studentSummary() { return { data: STUDENT_SUMMARY, error: null }; },
    async listReportPeriods() {
      const arrays = memoryArrays(state);
      if (!client) return { data: [...arrays.reportPeriods].sort((a, b) => b.start_date.localeCompare(a.start_date)), error: null };
      const result = await client.from('grade_report_periods').select(REPORT_PERIOD_SELECT).order('start_date', { ascending: false }).order('created_at', { ascending: false });
      return { data: result.data ? result.data.map((row) => mapReportPeriod(row as Record<string, unknown>)) : null, error: result.error };
    },
    async createReportPeriod(input) {
      const arrays = memoryArrays(state);
      if (!client) {
        const record: GradeReportPeriod = { id: `period-${Date.now()}`, academic_year: input.academicYear, semester: input.semester, start_date: input.startDate, end_date: input.endDate, status: 'draft', created_by: input.actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        arrays.reportPeriods.unshift(record);
        return { data: record, error: null };
      }
      const result = await client.from('grade_report_periods').insert({ academic_year: input.academicYear, semester: input.semester, start_date: input.startDate, end_date: input.endDate, created_by: input.actorId }).select(REPORT_PERIOD_SELECT).single();
      return { data: result.data ? mapReportPeriod(result.data as Record<string, unknown>) : null, error: result.error };
    },
    async listReports(query) {
      const arrays = memoryArrays(state);
      if (!client) {
        let rows = [...arrays.reports];
        if (query.period_id) rows = rows.filter((row) => row.period_id === query.period_id);
        if (query.student_id) rows = rows.filter((row) => row.student_id === query.student_id);
        return { data: rows, error: null };
      }
      let dbQuery = client.from('grade_reports').select(REPORT_SELECT).order('student_id', { ascending: true });
      if (query.period_id) dbQuery = dbQuery.eq('period_id', query.period_id);
      if (query.student_id) dbQuery = dbQuery.eq('student_id', query.student_id);
      if (query.kelas && query.kelas !== 'all') dbQuery = dbQuery.eq('students.kelas', query.kelas);
      const result = await dbQuery;
      return { data: result.data ? result.data.map((row) => mapGradeReport(row as Record<string, unknown>)) : null, error: result.error };
    },
    async generateReports(input) {
      const arrays = memoryArrays(state);
      if (!client) {
        const period = arrays.reportPeriods.find((row) => row.id === input.periodId);
        if (!period) return { data: null, error: { code: 'REPORT_PERIOD_NOT_FOUND', message: 'Periode laporan tidak ditemukan.' } };
        const studentIds = [...new Set(state.grades.map((row) => row.student_id))];
        const reports = studentIds.map((studentId) => {
          const gradeEvidence: ReportGradeEvidence[] = state.grades.filter((row) => row.student_id === studentId).map((row) => ({ nilai: row.nilai, dueDate: row.updated_at || row.created_at }));
          const calculated = calculateGradeReport(gradeEvidence, [], [], { startDate: period.start_date, endDate: period.end_date });
          return { id: `report-${period.id}-${studentId}`, period_id: period.id, student_id: studentId, predikat: calculated.predikat || undefined, status: 'draft' as const, deskripsi: calculated.deskripsi, evidence_count: calculated.evidenceCount, hadir_count: calculated.hadirCount, sakit_count: calculated.sakitCount, izin_count: calculated.izinCount, alpha_count: calculated.alphaCount, pkl_days: calculated.pklDays, attendance_percentage: calculated.attendancePercentage ?? undefined, generated_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        });
        arrays.reports = arrays.reports.filter((row) => row.period_id !== input.periodId).concat(reports);
        return { data: reports, error: null };
      }

      const periodResult = await client.from('grade_report_periods').select(REPORT_PERIOD_SELECT).eq('id', input.periodId).maybeSingle();
      if (periodResult.error) return { data: null, error: periodResult.error };
      if (!periodResult.data) return { data: null, error: { code: 'REPORT_PERIOD_NOT_FOUND', message: 'Periode laporan tidak ditemukan.' } };
      const period = periodResult.data;

      const existingResult = await client.from('grade_reports').select('student_id,status').eq('period_id', input.periodId);
      if (existingResult.error) return { data: null, error: existingResult.error };
      if ((existingResult.data || []).some((row) => String((row as Record<string, unknown>).status) === 'approved')) {
        return { data: null, error: { code: 'REPORT_APPROVED_LOCKED', message: 'Laporan yang sudah disahkan tidak dapat dibuat ulang.' } };
      }

      const [studentsResult, assignmentsResult] = await Promise.all([
        client.from('students').select('id,nis,nama,kelas').eq('is_active', true).order('nama', { ascending: true }),
        client.from('assignments').select('id,due_date').gte('due_date', period.start_date).lte('due_date', period.end_date),
      ]);
      if (studentsResult.error) return { data: null, error: studentsResult.error };
      if (assignmentsResult.error) return { data: null, error: assignmentsResult.error };
      const students = (studentsResult.data || []).map((row) => row as Record<string, unknown>);
      const assignmentIds = (assignmentsResult.data || []).map((row) => String((row as Record<string, unknown>).id));
      const [gradesResult, attendanceResult, pklResult] = await Promise.all([
        assignmentIds.length > 0 ? client.from('grades').select('student_id,nilai,assignments(due_date)').eq('status', 'graded').in('assignment_id', assignmentIds) : Promise.resolve({ data: [], error: null }),
        client.from('attendance').select('student_id,tanggal,status').gte('tanggal', period.start_date).lte('tanggal', period.end_date),
        client.from('student_pkl_periods').select(PKL_SELECT).in('status', ['approved', 'completed']),
      ]);
      if (gradesResult.error) return { data: null, error: gradesResult.error };
      if (attendanceResult.error) return { data: null, error: attendanceResult.error };
      if (pklResult.error) return { data: null, error: pklResult.error };

      const gradesByStudent = new Map<string, ReportGradeEvidence[]>();
      for (const row of (gradesResult.data || [])) {
        const value = row as Record<string, unknown>;
        const assignment = databaseRow(value.assignments);
        const studentId = String(value.student_id ?? '');
        const nilai = String(value.nilai ?? '') as ReportGradeEvidence['nilai'];
        if (studentId && ['A', 'B', 'C', 'D', 'E'].includes(nilai)) {
          const evidence = gradesByStudent.get(studentId) || [];
          evidence.push({ nilai, dueDate: String(assignment.due_date ?? '') });
          gradesByStudent.set(studentId, evidence);
        }
      }
      const attendanceByStudent = new Map<string, ReportAttendanceEvidence[]>();
      for (const row of (attendanceResult.data || [])) {
        const value = row as Record<string, unknown>;
        const status = String(value.status ?? '') as ReportAttendanceEvidence['status'];
        if (!['hadir', 'sakit', 'izin', 'alpha'].includes(status)) continue;
        const studentId = String(value.student_id ?? '');
        const evidence = attendanceByStudent.get(studentId) || [];
        evidence.push({ tanggal: String(value.tanggal ?? ''), status });
        attendanceByStudent.set(studentId, evidence);
      }
      const pklByStudent = new Map<string, StudentPklPeriod[]>();
      for (const row of (pklResult.data || [])) {
        const period = mapPklPeriod(row as Record<string, unknown>);
        const evidence = pklByStudent.get(period.student_id) || [];
        evidence.push(period);
        pklByStudent.set(period.student_id, evidence);
      }

      const generatedAt = new Date().toISOString();
      const payload = students.map((student) => {
        const studentId = String(student.id);
        const calculated = calculateGradeReport(gradesByStudent.get(studentId) || [], attendanceByStudent.get(studentId) || [], pklByStudent.get(studentId) || [], { startDate: period.start_date, endDate: period.end_date });
        return { period_id: input.periodId, student_id: studentId, predikat: calculated.predikat, status: 'draft', deskripsi: calculated.deskripsi, evidence_count: calculated.evidenceCount, hadir_count: calculated.hadirCount, sakit_count: calculated.sakitCount, izin_count: calculated.izinCount, alpha_count: calculated.alphaCount, pkl_days: calculated.pklDays, attendance_percentage: calculated.attendancePercentage, generated_at: generatedAt, approved_by: null, approved_at: null, updated_by: input.actorId, updated_at: generatedAt };
      });
      if (payload.length === 0) return { data: [], error: null };
      const upsertResult = await client.from('grade_reports').upsert(payload, { onConflict: 'period_id,student_id' }).select(REPORT_SELECT);
      return { data: upsertResult.data ? upsertResult.data.map((row) => mapGradeReport(row as Record<string, unknown>)) : null, error: upsertResult.error };
    },
    async approveReports(input) {
      if (!client) {
        const arrays = memoryArrays(state);
        const rows = arrays.reports.filter((row) => row.period_id === input.periodId);
        if (rows.some((row) => !row.predikat)) return { data: null, error: { code: 'REPORT_EVIDENCE_INCOMPLETE', message: 'Semua siswa harus memiliki bukti penilaian sebelum laporan disahkan.' } };
        const now = new Date().toISOString();
        rows.forEach((row) => Object.assign(row, { status: 'approved' as const, approved_by: input.actorId, approved_at: now, updated_by: input.actorId, updated_at: now }));
        return { data: rows, error: null };
      }
      const rowsResult = await client.from('grade_reports').select('id,predikat').eq('period_id', input.periodId);
      if (rowsResult.error) return { data: null, error: rowsResult.error };
      if (!rowsResult.data?.length || rowsResult.data.some((row) => !(row as Record<string, unknown>).predikat)) return { data: null, error: { code: 'REPORT_EVIDENCE_INCOMPLETE', message: 'Semua siswa harus memiliki bukti penilaian sebelum laporan disahkan.' } };
      const now = new Date().toISOString();
      const updateResult = await client.from('grade_reports').update({ status: 'approved', approved_by: input.actorId, approved_at: now, updated_by: input.actorId, updated_at: now }).eq('period_id', input.periodId).select(REPORT_SELECT);
      if (updateResult.error) return { data: null, error: updateResult.error };
      await client.from('grade_report_periods').update({ status: 'approved', approved_by: input.actorId, approved_at: now, updated_at: now }).eq('id', input.periodId);
      return { data: updateResult.data ? updateResult.data.map((row) => mapGradeReport(row as Record<string, unknown>)) : null, error: null };
    },
    async listPklPeriods(query) {
      const arrays = memoryArrays(state);
      if (!client) {
        let rows = [...arrays.pklPeriods];
        if (query.studentId) rows = rows.filter((row) => row.student_id === query.studentId);
        return { data: rows, error: null };
      }
      let dbQuery = client.from('student_pkl_periods').select(PKL_SELECT).order('start_date', { ascending: false });
      if (query.studentId) dbQuery = dbQuery.eq('student_id', query.studentId);
      if (query.kelas && query.kelas !== 'all') dbQuery = dbQuery.eq('students.kelas', query.kelas);
      const result = await dbQuery;
      return { data: result.data ? result.data.map((row) => mapPklPeriod(row as Record<string, unknown>)) : null, error: result.error };
    },
    async createPklPeriod(input) {
      const arrays = memoryArrays(state);
      if (!client) {
        const record: StudentPklPeriod = { id: `pkl-${Date.now()}`, student_id: input.studentId, start_date: input.startDate, end_date: input.endDate, institution: input.institution, notes: input.notes, status: 'pending', requested_by: input.actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        arrays.pklPeriods.unshift(record);
        return { data: record, error: null };
      }
      const result = await client.from('student_pkl_periods').insert({ student_id: input.studentId, start_date: input.startDate, end_date: input.endDate, institution: input.institution, notes: input.notes || null, requested_by: input.actorId }).select(PKL_SELECT).single();
      return { data: result.data ? mapPklPeriod(result.data as Record<string, unknown>) : null, error: result.error };
    },
    async reviewPklPeriod(input) {
      const arrays = memoryArrays(state);
      if (!client) {
        const record = arrays.pklPeriods.find((row) => row.id === input.id);
        if (!record) return { data: null, error: { code: 'PKL_PERIOD_NOT_FOUND', message: 'Periode PKL tidak ditemukan.' } };
        Object.assign(record, { status: input.status, reviewed_by: input.actorId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return { data: record, error: null };
      }
      const result = await client.from('student_pkl_periods').update({ status: input.status, reviewed_by: input.actorId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', input.id).select(PKL_SELECT).single();
      return { data: result.data ? mapPklPeriod(result.data as Record<string, unknown>) : null, error: result.error };
    },
  };
}
