import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseError } from '../../shared/database/database.types.js';
import { mapAssignmentRow, mapGradeRow } from './grades.helpers.js';
import type {
  AssignmentListQuery, AssignmentRecord, BulkGradeItem, CreateAssignmentInput, GradeDistribution, GradeListQuery,
  GradeRecord, StudentGradeSummary,
} from './grades.types.js';

type SupabaseLike = SupabaseClient | null;
export type GradesMemoryState = { grades: GradeRecord[]; assignments: AssignmentRecord[] };
export interface GradesRepository {
  isConfigured(): boolean;
  listGrades(query: GradeListQuery): Promise<{ data: { data: GradeRecord[]; total: number; page: number; pageSize: number; totalPages: number } | null; error: DatabaseError | null }>;
  listAssignments(query: AssignmentListQuery): Promise<{ data: { data: AssignmentRecord[]; total: number; page: number; pageSize: number; totalPages: number } | null; error: DatabaseError | null }>;
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

export function createGradesRepository(client: SupabaseLike, state: GradesMemoryState): GradesRepository {
  return {
    isConfigured: () => client !== null,
    async listGrades(query) {
      const { page, pageSize, from, to } = pageValues(query, 50);
      if (!client) {
        let rows = [...state.grades];
        if (query.assignment_id) rows = rows.filter((row) => row.assignment_id === query.assignment_id);
        if (query.student_id) rows = rows.filter((row) => row.student_id === query.student_id);
        const total = rows.length;
        return { data: { data: rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
      }
      let dbQuery = client.from('grades').select(GRADE_SELECT, { count: 'exact' });
      if (query.assignment_id) dbQuery = dbQuery.eq('assignment_id', query.assignment_id);
      if (query.student_id) dbQuery = dbQuery.eq('student_id', query.student_id);
      dbQuery = dbQuery.order('updated_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
      const result = await dbQuery;
      if (result.error) return { data: null, error: result.error };
      let rows: GradeRecord[] = (result.data || []).map((row) => mapGradeRow(row as Record<string, unknown>));
      const search = query.search?.trim().toLowerCase();
      if (search) rows = rows.filter((row) => [row.student_nama, row.student_nis, row.assignment_title].some((value) => String(value || '').toLowerCase().includes(search)));
      if (query.kelas && query.kelas !== 'all') rows = rows.filter((row) => String(row.kelas || '').toLowerCase().startsWith(query.kelas!.trim().toLowerCase()));
      if (query.category && query.category !== 'all') rows = rows.filter((row) => row.assignment_category === query.category);
      const total = result.count ?? rows.length;
      return { data: { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
    },
    async listAssignments(query) {
      const { page, pageSize, from, to } = pageValues(query, 10);
      if (!client) {
        let rows = [...state.assignments];
        if (query.category && query.category !== 'all') rows = rows.filter((row) => row.category === query.category);
        if (query.kelas && query.kelas !== 'all') rows = rows.filter((row) => row.kelas === query.kelas || row.kelas === 'Semua');
        if (query.search) { const search = query.search.toLowerCase(); rows = rows.filter((row) => `${row.title} ${row.description || ''} ${row.kelas || ''}`.toLowerCase().includes(search)); }
        const total = rows.length;
        return { data: { data: rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
      }
      let dbQuery = client.from('assignments').select('id,title,category,deskripsi,keterangan_kategori,kelas,due_date,created_by,updated_by,updated_at,created_at', { count: 'exact' });
      if (query.category && query.category !== 'all') dbQuery = dbQuery.eq('category', query.category);
      if (query.kelas && query.kelas !== 'all' && ['X', 'XI', 'XII'].includes(query.kelas)) dbQuery = dbQuery.in('kelas', [query.kelas, 'Semua']);
      const search = query.search?.trim().replace(/[^a-zA-Z0-9 -]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
      if (search) dbQuery = dbQuery.or(`title.ilike.%${search}%,deskripsi.ilike.%${search}%,kelas.ilike.%${search}%`);
      const result = await dbQuery.order('due_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to);
      if (result.error) return { data: null, error: result.error };
      const rows = (result.data || []).map((row) => mapAssignmentRow(row as Record<string, unknown>));
      const total = result.count ?? rows.length;
      return { data: { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
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
