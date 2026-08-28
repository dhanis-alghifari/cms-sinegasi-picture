import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseError } from '../../shared/database/database.types.js';
import { mapAssignmentRow, mapGradeRow, matchesClassFilter } from './grades.helpers.js';
import type {
  AssignmentListQuery, AssignmentRecord, BulkGradeItem, CreateAssignmentInput, GradeDistribution, GradeListQuery,
  GradeRecord, GradeSummary, StudentGradeSummary,
} from './grades.types.js';

type SupabaseLike = SupabaseClient | null;
export type GradesMemoryState = { grades: GradeRecord[]; assignments: AssignmentRecord[] };
export interface GradesRepository {
  isConfigured(): boolean;
  listGrades(query: GradeListQuery): Promise<{ data: { data: GradeRecord[]; total: number; page: number; pageSize: number; totalPages: number } | null; error: DatabaseError | null }>;
  listAssignments(query: AssignmentListQuery): Promise<{ data: { data: AssignmentRecord[]; total: number; page: number; pageSize: number; totalPages: number } | null; error: DatabaseError | null }>;
  summary(query: GradeListQuery): Promise<{ data: GradeSummary | null; error: DatabaseError | null }>;
  createAssignment(input: { title: string; category: string; description: string | null; categoryDescription: string | null; kelas: string | null; dueDate: string; actorId: string | null }): Promise<{ data: AssignmentRecord | null; error: DatabaseError | null }>;
  bulkGrade(input: { assignmentId: string; grades: BulkGradeItem[]; actorId: string; changeReason: string }): Promise<{ data: unknown; error: DatabaseError | null }>;
  distribution(query: { category?: string; kelas?: string; periode?: string }): Promise<{ data: { filters: Record<string, string>; totalAssignments: number; data: GradeDistribution[] } | null; error: DatabaseError | null }>;
  studentSummary(): Promise<{ data: StudentGradeSummary[] | null; error: DatabaseError | null }>;
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
        const assignmentResult = await assignmentQuery;
        if (assignmentResult.error) return { data: null, error: assignmentResult.error };
        categoryAssignmentIds = uniqueIds((assignmentResult.data || []).map((row) => row.id));
        if (categoryAssignmentIds.length === 0) return { data: emptyPage(page, pageSize), error: null };
      }

      let searchAssignmentIds: string[] | undefined;
      if (search) {
        const assignmentResult = await client.from('assignments').select('id').or(`title.ilike.%${search}%,deskripsi.ilike.%${search}%`);
        if (assignmentResult.error) return { data: null, error: assignmentResult.error };
        searchAssignmentIds = uniqueIds((assignmentResult.data || []).map((row) => row.id));
      }

      let classStudentIds: string[] | undefined;
      if (query.kelas && query.kelas !== 'all' && query.scope !== 'own') {
        const studentResult = await client.from('students').select('id').eq('is_active', true).or(`kelas.eq.${query.kelas},kelas.ilike.${query.kelas} %`);
        if (studentResult.error) return { data: null, error: studentResult.error };
        classStudentIds = uniqueIds((studentResult.data || []).map((row) => row.id));
        if (classStudentIds.length === 0) return { data: emptyPage(page, pageSize), error: null };
      }

      let searchStudentIds: string[] | undefined;
      if (search && query.scope !== 'own') {
        const studentResult = await client.from('students').select('id').eq('is_active', true).or(`nama.ilike.%${search}%,nis.ilike.%${search}%`);
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
      let dbQuery = client.from('grades').select(GRADE_SELECT).eq('status', 'graded');
      if (query.student_id) dbQuery = dbQuery.eq('student_id', query.student_id);
      if (query.category && query.category !== 'all') {
        const assignmentResult = await client.from('assignments').select('id').eq('category', query.category);
        if (assignmentResult.error) return { data: null, error: assignmentResult.error };
        const assignmentIds = uniqueIds((assignmentResult.data || []).map((row) => row.id));
        if (assignmentIds.length === 0) return { data: { total: 0, counts }, error: null };
        dbQuery = dbQuery.in('assignment_id', assignmentIds);
      }
      const result = await dbQuery.order('updated_at', { ascending: false }).order('id', { ascending: false });
      if (result.error) return { data: null, error: result.error };
      const rows = (result.data || []).map((row) => mapGradeRow(row as Record<string, unknown>));
      rows.forEach((row) => { if (row.nilai in counts) counts[row.nilai] += 1; });
      return { data: { total: rows.length, counts, latest: rows[0] }, error: null };
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
  };
}
