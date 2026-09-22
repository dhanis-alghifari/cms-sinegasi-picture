import { gradesErrorMessage, isMissingGradesSchemaError, normalizeAssignmentCategory } from './grades.helpers.js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import type { GradesRepository } from './grades.repository.js';
import type { AssignmentListQuery, BulkGradeInput, CreateAssignmentInput, CreatePklPeriodInput, CreateReportPeriodInput, GradeListQuery, GradeReportQuery, ReportSemester, ReviewPklPeriodInput } from './grades.types.js';

export class GradesServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) { super(message); this.name = 'GradesServiceError'; }
}

function clean(value: unknown): string | null { const normalized = typeof value === 'string' ? value.trim() : ''; return normalized || null; }
function isUuid(value: string): boolean { return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value); }
function isDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
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

  async summary(query: GradeListQuery) {
    const category = query.category && query.category !== 'all' ? normalizeAssignmentCategory(query.category) : undefined;
    if (query.category && query.category !== 'all' && !category) throw new GradesServiceError(422, 'INVALID_CATEGORY', 'Kategori tugas tidak valid.');
    const result = await this.repository.summary({ ...query, category: category || undefined });
    if (result.error || !result.data) listError(result.error, 'Gagal memuat rekap nilai.');
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

  async listReportPeriods() {
    const result = await this.repository.listReportPeriods();
    if (result.error || !result.data) listError(result.error, 'Gagal memuat periode raport.');
    return result.data;
  }

  async createReportPeriod(input: Record<string, unknown>, actorId: string | null) {
    const academicYear = clean(input.academic_year ?? input.academicYear);
    const semester = clean(input.semester) as ReportSemester | null;
    const startDate = clean(input.start_date ?? input.startDate);
    const endDate = clean(input.end_date ?? input.endDate);
    if (!academicYear || !/^\d{4}\/\d{4}$/.test(academicYear) || !semester || !['ganjil', 'genap'].includes(semester) || !startDate || !endDate || !isDate(startDate) || !isDate(endDate) || startDate > endDate) {
      throw new GradesServiceError(422, 'INVALID_REPORT_PERIOD', 'Tahun ajaran, semester, dan rentang tanggal raport tidak valid.');
    }
    if (!actorId) throw new GradesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun pengguna tidak memiliki ID database yang valid.');
    const result = await this.repository.createReportPeriod({ academicYear, semester, startDate, endDate, actorId } satisfies CreateReportPeriodInput);
    if (result.error || !result.data) throw new GradesServiceError(isMissingGradesSchemaError(result.error) ? 503 : 400, isMissingGradesSchemaError(result.error) ? 'GRADES_SCHEMA_UNAVAILABLE' : 'REPORT_PERIOD_CREATE_FAILED', isMissingGradesSchemaError(result.error) ? gradesErrorMessage(result.error) : 'Gagal membuat periode raport.');
    return result.data;
  }

  async listReports(query: GradeReportQuery) {
    if (query.period_id && !isUuid(query.period_id)) throw new GradesServiceError(422, 'INVALID_REPORT_PERIOD', 'period_id tidak valid.');
    const result = await this.repository.listReports(query);
    if (result.error || !result.data) listError(result.error, 'Gagal memuat raport siswa.');
    return result.data;
  }

  async generateReports(periodId: string | undefined, actorId: string | null) {
    if (!periodId || !isUuid(periodId)) throw new GradesServiceError(422, 'INVALID_REPORT_PERIOD', 'period_id tidak valid.');
    if (!actorId) throw new GradesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun pengguna tidak memiliki ID database yang valid.');
    const result = await this.repository.generateReports({ periodId, actorId });
    if (result.error || !result.data) throw new GradesServiceError(isMissingGradesSchemaError(result.error) ? 503 : 400, isMissingGradesSchemaError(result.error) ? 'GRADES_SCHEMA_UNAVAILABLE' : result.error?.code || 'REPORT_GENERATE_FAILED', isMissingGradesSchemaError(result.error) ? gradesErrorMessage(result.error) : result.error?.message || 'Gagal membuat rekap raport.');
    return result.data;
  }

  async approveReports(periodId: string | undefined, actorId: string | null) {
    if (!periodId || !isUuid(periodId)) throw new GradesServiceError(422, 'INVALID_REPORT_PERIOD', 'period_id tidak valid.');
    if (!actorId) throw new GradesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun pengguna tidak memiliki ID database yang valid.');
    const result = await this.repository.approveReports({ periodId, actorId });
    if (result.error || !result.data) throw new GradesServiceError(isMissingGradesSchemaError(result.error) ? 503 : 400, isMissingGradesSchemaError(result.error) ? 'GRADES_SCHEMA_UNAVAILABLE' : result.error?.code || 'REPORT_APPROVE_FAILED', isMissingGradesSchemaError(result.error) ? gradesErrorMessage(result.error) : result.error?.message || 'Gagal mengesahkan raport.');
    return result.data;
  }

  async listPklPeriods(query: { student_id?: string; kelas?: string }) {
    if (query.student_id && !isUuid(query.student_id)) throw new GradesServiceError(422, 'INVALID_STUDENT', 'student_id tidak valid.');
    const result = await this.repository.listPklPeriods({ studentId: query.student_id, kelas: query.kelas });
    if (result.error || !result.data) listError(result.error, 'Gagal memuat periode PKL.');
    return result.data;
  }

  async createPklPeriod(input: Record<string, unknown>, actorId: string | null) {
    const studentId = clean(input.student_id ?? input.studentId);
    const startDate = clean(input.start_date ?? input.startDate);
    const endDate = clean(input.end_date ?? input.endDate);
    const institution = clean(input.institution);
    const notes = clean(input.notes);
    if (!studentId || !isUuid(studentId) || !startDate || !endDate || !isDate(startDate) || !isDate(endDate) || startDate > endDate || !institution || institution.length > 200 || (notes && notes.length > 1000)) {
      throw new GradesServiceError(422, 'INVALID_PKL_PERIOD', 'Siswa, rentang tanggal, dan tempat PKL wajib valid.');
    }
    if (!actorId) throw new GradesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun pengguna tidak memiliki ID database yang valid.');
    const result = await this.repository.createPklPeriod({ studentId, startDate, endDate, institution, notes: notes || undefined, actorId } satisfies CreatePklPeriodInput);
    if (result.error || !result.data) throw new GradesServiceError(isMissingGradesSchemaError(result.error) ? 503 : 400, isMissingGradesSchemaError(result.error) ? 'GRADES_SCHEMA_UNAVAILABLE' : 'PKL_PERIOD_CREATE_FAILED', isMissingGradesSchemaError(result.error) ? gradesErrorMessage(result.error) : 'Gagal menyimpan periode PKL.');
    return result.data;
  }

  async reviewPklPeriod(input: Record<string, unknown>, actorId: string | null) {
    const id = clean(input.id);
    const status = clean(input.status) as ReviewPklPeriodInput['status'] | null;
    if (!id || !isUuid(id) || !status || !['approved', 'rejected', 'completed'].includes(status)) throw new GradesServiceError(422, 'INVALID_PKL_REVIEW', 'Status review PKL tidak valid.');
    if (!actorId) throw new GradesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun pengguna tidak memiliki ID database yang valid.');
    const result = await this.repository.reviewPklPeriod({ id, status, actorId });
    if (result.error || !result.data) throw new GradesServiceError(isMissingGradesSchemaError(result.error) ? 503 : 400, isMissingGradesSchemaError(result.error) ? 'GRADES_SCHEMA_UNAVAILABLE' : 'PKL_REVIEW_FAILED', isMissingGradesSchemaError(result.error) ? gradesErrorMessage(result.error) : result.error?.message || 'Gagal memperbarui status PKL.');
    return result.data;
  }
}
