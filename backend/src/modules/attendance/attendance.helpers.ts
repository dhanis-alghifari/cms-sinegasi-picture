import type { DatabaseRow } from '../../shared/database/database.types.js';

const ATTENDANCE_CLASS_LEVELS = new Set(['X', 'XI', 'XII']);

export type AttendanceClassFilter =
  | { kind: 'level'; expression: string }
  | { kind: 'exact'; value: string };

/**
 * Build a class filter without treating `X` as a raw prefix of `XI`/`XII`.
 *
 * A level filter includes the bare level and its named classes (`X AK 3`),
 * while a full class name remains an exact match.
 */
export function buildAttendanceClassFilter(value: string): AttendanceClassFilter {
  const normalizedClass = value.trim();
  if (ATTENDANCE_CLASS_LEVELS.has(normalizedClass)) {
    return {
      kind: 'level',
      expression: `kelas.eq.${normalizedClass},kelas.ilike.${normalizedClass} %`,
    };
  }

  return { kind: 'exact', value: normalizedClass };
}

/**
 * Public shape returned by the attendance list endpoint.
 *
 * Supabase returns the student relation under `students`. That relation is a
 * database detail, so it is flattened here before the row crosses the API
 * boundary. Consumers should not need to know how the join was written.
 */
export type AttendanceListRecord = {
  id: string;
  student_id: string;
  student_nis: string;
  student_nama: string;
  kelas: string;
  tanggal: string;
  status: string;
  keterangan: string | null;
  is_locked: boolean;
  idempotency_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

function getStudentRelation(row: DatabaseRow): DatabaseRow {
  const relation = row.students;
  const student = Array.isArray(relation) ? relation[0] : relation;
  return student && typeof student === 'object' ? student as DatabaseRow : {};
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

/** Map a PostgREST attendance row into the stable HTTP response contract. */
export function mapAttendanceRow(row: DatabaseRow): AttendanceListRecord {
  const student = getStudentRelation(row);

  return {
    id: String(row.id ?? ''),
    student_id: String(row.student_id ?? ''),
    student_nis: String(student.nis ?? ''),
    student_nama: String(student.nama ?? ''),
    kelas: String(student.kelas ?? ''),
    tanggal: String(row.tanggal ?? ''),
    status: String(row.status ?? ''),
    keterangan: nullableString(row.keterangan),
    is_locked: Boolean(row.is_locked),
    idempotency_key: nullableString(row.idempotency_key),
    created_by: nullableString(row.created_by),
    created_at: String(row.created_at ?? ''),
    updated_by: nullableString(row.updated_by),
    updated_at: nullableString(row.updated_at),
  };
}
