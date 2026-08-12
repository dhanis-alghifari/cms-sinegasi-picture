import { gradesErrorMessage, isMissingGradesSchemaError, normalizeAssignmentCategory } from './grades.helpers.js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import type { GradesRepository } from './grades.repository.js';
import type { AssignmentListQuery, BulkGradeInput, CreateAssignmentInput, GradeListQuery } from './grades.types.js';

export class GradesServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) { super(message); this.name = 'GradesServiceError'; }
}

function clean(value: unknown): string | null { const normalized = typeof value === 'string' ? value.trim() : ''; return normalized || null; }
function isUuid(value: string): boolean { return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value); }
function listError(error: unknown, fallback: string): never {
  const databaseError = asDatabaseError(error);
  const schemaUnavailable = isMissingGradesSchemaError(databaseError);
  throw new GradesServiceError(schemaUnavailable ? 503 : 500, schemaUnavailable ? 'GRADES_SCHEMA_UNAVAILABLE' : 'GRADES_READ_FAILED', schemaUnavailable ? gradesErrorMessage(databaseError) : fallback);
}

export class GradesService {
  constructor(private readonly repository: GradesRepository) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async listGrades(query: GradeListQuery) {
    const category = query.category && query.category !== 'all' ? normalizeAssignmentCategory(query.category) : undefined;
    if (query.category && query.category !== 'all' && !category) throw new GradesServiceError(422, 'INVALID_CATEGORY', 'Kategori tugas tidak valid.');
    const result = await this.repository.listGrades({ ...query, category: category || undefined, search: query.search?.trim().slice(0, 100) });
    if (result.error || !result.data) listError(result.error, 'Gagal memuat data nilai.');
    return result.data;
  }

  async listAssignments(query: AssignmentListQuery) {
    const category = query.category && query.category !== 'all' ? normalizeAssignmentCategory(query.category) : undefined;
    if (query.category && query.category !== 'all' && !category) return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    const result = await this.repository.listAssignments({ ...query, category: category || undefined, search: query.search?.trim().slice(0, 100) });
    if (result.error || !result.data) listError(result.error, 'Gagal memuat daftar tugas.');
    return result.data;
  }

  async createAssignment(input: CreateAssignmentInput, actorId: string | null) {
    const title = clean(input.title); const category = normalizeAssignmentCategory(input.category); const dueDate = clean(input.due_date || input.date);
    const description = clean(input.description); const categoryDescription = clean(input.keterangan_kategori || input.description); const kelas = clean(input.kelas);
    if (!title || title.length > 200 || !category || !dueDate) throw new GradesServiceError(422, 'INVALID_INPUT', 'title, category, dan due_date wajib diisi.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new GradesServiceError(422, 'INVALID_DATE', 'due_date harus berupa tanggal YYYY-MM-DD.');
    if (category === 'other' && (!categoryDescription || categoryDescription.length < 3)) throw new GradesServiceError(422, 'CATEGORY_DESCRIPTION_REQUIRED', 'Keterangan kategori Lainnya minimal 3 karakter.');
    const result = await this.repository.createAssignment({ title, category, description, categoryDescription, kelas, dueDate, actorId });
    if (result.error) throw new GradesServiceError(isMissingGradesSchemaError(result.error) ? 503 : 400, isMissingGradesSchemaError(result.error) ? 'GRADES_SCHEMA_UNAVAILABLE' : 'ASSIGNMENT_CREATE_FAILED', isMissingGradesSchemaError(result.error) ? gradesErrorMessage(result.error) : 'Gagal membuat tugas baru.');
    if (!result.data) throw new GradesServiceError(500, 'ASSIGNMENT_NOT_CREATED', 'Server tidak mengembalikan data tugas yang dibuat.');
    return result.data;
  }

  async bulkGrade(input: BulkGradeInput, actorId: string | null, headerReason?: string) {
    const assignmentId = clean(input.assignment_id); const grades = input.grades || []; const changeReason = clean(headerReason) || clean(input.change_reason);
    if (!assignmentId || grades.length === 0 || grades.length > 500) throw new GradesServiceError(422, 'INVALID_INPUT', 'assignment_id dan 1 sampai 500 grades wajib diisi.');
    if (!changeReason || changeReason.length < 5) throw new GradesServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan penyimpanan nilai minimal 5 karakter.');
    if (!actorId) throw new GradesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun pengguna tidak memiliki ID database yang valid.');
    if (grades.some((grade) => !isUuid(grade.student_id) || !['A', 'B', 'C', 'D', 'E'].includes(grade.nilai) || (grade.keterangan && grade.keterangan.length > 500))) {
      throw new GradesServiceError(422, 'INVALID_GRADE', 'Data siswa atau predikat nilai tidak valid.');
    }
    const result = await this.repository.bulkGrade({ assignmentId, grades, actorId, changeReason });
    if (result.error) throw new GradesServiceError(isMissingGradesSchemaError(result.error) ? 503 : 400, isMissingGradesSchemaError(result.error) ? 'GRADES_SCHEMA_UNAVAILABLE' : 'BULK_GRADE_FAILED', isMissingGradesSchemaError(result.error) ? gradesErrorMessage(result.error) : 'Gagal menyimpan nilai siswa.');
    return { data: result.data, count: grades.length };
  }

  async distribution(query: { category?: string; kelas?: string; periode?: string }) {
    const category = query.category && query.category !== 'all' ? normalizeAssignmentCategory(query.category) : undefined;
    if (query.category && query.category !== 'all' && !category) throw new GradesServiceError(422, 'INVALID_CATEGORY', 'Kategori tugas tidak valid.');
    const result = await this.repository.distribution({ ...query, category: category || undefined });
    if (result.error || !result.data) throw new GradesServiceError(500, 'GRADES_DISTRIBUTION_FAILED', 'Gagal memuat distribusi nilai.');
    return result.data;
  }

  async studentSummary() {
    const result = await this.repository.studentSummary();
    if (result.error || !result.data) throw new GradesServiceError(500, 'GRADE_SUMMARY_FAILED', 'Gagal memuat rangkuman nilai siswa.');
    return result.data;
  }
}
