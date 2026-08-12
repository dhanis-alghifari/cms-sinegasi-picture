import { runtimeConfig } from '../../config/env.js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import type { AssignmentCategory, GradeRecord } from './grades.types.js';
import type { DatabaseRow } from '../../shared/database/database.types.js';

export const GRADES_SCHEMA_MIGRATION_MESSAGE = 'Skema nilai belum terpasang. Jalankan "npm run db:migrate:grades" di folder backend, lalu restart backend.';

const CATEGORY_ALIASES: Record<string, AssignmentCategory> = {
  Kelas: 'class_task', 'Crew Film': 'crew_film', Event: 'event_participation', Lainnya: 'other',
  class_task: 'class_task', crew_film: 'crew_film', event_participation: 'event_participation', other: 'other',
};

export function normalizeAssignmentCategory(value: unknown): AssignmentCategory | null {
  return typeof value === 'string' ? CATEGORY_ALIASES[value.trim()] || null : null;
}

export function matchesClassFilter(studentClass: unknown, requestedClass: string): boolean {
  const actual = String(studentClass || '').trim().toLowerCase();
  const requested = requestedClass.trim().toLowerCase();
  return actual === requested || actual.startsWith(`${requested} `);
}

export function mapAssignmentRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''), title: String(row.title ?? ''), category: normalizeAssignmentCategory(row.category) || 'other',
    description: row.deskripsi == null && row.keterangan_kategori == null ? undefined : String(row.deskripsi ?? row.keterangan_kategori),
    kelas: row.kelas == null ? undefined : String(row.kelas),
    date: String(row.due_date ?? row.date ?? ''), created_by: row.created_by == null ? undefined : String(row.created_by), updated_by: row.updated_by == null ? undefined : String(row.updated_by),
    updated_at: row.updated_at == null ? undefined : String(row.updated_at), created_at: String(row.created_at ?? ''),
  };
}

export function mapGradeRow(row: Record<string, unknown>): GradeRecord {
  const assignment = row.assignments && typeof row.assignments === 'object' ? row.assignments as DatabaseRow : {};
  const student = row.students && typeof row.students === 'object' ? row.students as DatabaseRow : {};
  return {
    id: String(row.id ?? ''), assignment_id: String(row.assignment_id ?? ''), assignment_title: assignment.title == null ? undefined : String(assignment.title),
    assignment_category: normalizeAssignmentCategory(assignment.category) || undefined, student_id: String(row.student_id ?? ''),
    student_nis: student.nis == null ? undefined : String(student.nis), student_nama: student.nama == null ? undefined : String(student.nama),
    kelas: student.kelas == null ? undefined : String(student.kelas), nilai: String(row.nilai || 'E') as GradeRecord['nilai'],
    keterangan: row.keterangan == null ? undefined : String(row.keterangan),
    graded_by: String(row.graded_by ?? ''), created_by: row.created_by == null && row.graded_by == null ? undefined : String(row.created_by ?? row.graded_by),
    updated_by: row.updated_by == null && row.graded_by == null ? undefined : String(row.updated_by ?? row.graded_by),
    created_at: String(row.created_at ?? row.updated_at ?? ''), updated_at: row.updated_at == null ? undefined : String(row.updated_at),
  };
}

export function isMissingGradesSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(error.code || '')
    || error.message?.includes('record_grades_bulk_atomic') === true;
}

export function gradesErrorMessage(error: unknown): string {
  const databaseError = asDatabaseError(error);
  if (isMissingGradesSchemaError(databaseError)) return GRADES_SCHEMA_MIGRATION_MESSAGE;
  const message = databaseError?.message?.trim() || '';
  if (message && !/[{};]/.test(message) && !/\b(SELECT|UPDATE|INSERT|DELETE|FROM|WHERE)\b/i.test(message)) return message;
  return runtimeConfig.environment === 'production' ? 'Gagal memproses data nilai.' : message || 'Gagal memproses data nilai.';
}
