import type { DatabaseRow } from '../../shared/database/database.types.js';
import type { AttendanceRepositoryError, AttendanceSummary } from './attendance.repository.js';

export const ATTENDANCE_LIST_SELECT = 'id,student_id,tanggal,status,keterangan,is_locked,idempotency_key,created_by,created_at,updated_by,updated_at,students!inner(id,nis,nama,kelas,peminatan)';
export const ATTENDANCE_RECORD_SELECT = 'id,student_id,tanggal,status,keterangan,is_locked,idempotency_key,created_by,created_at,updated_by,updated_at,students!inner(id,nis,nama,kelas,peminatan)';
export const ATTENDANCE_ROSTER_STUDENT_SELECT = 'id,nis,nama,kelas';

export function sanitizeAttendanceSearch(value: string): string {
  return value.trim().replace(/[%,_()]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

export function isMissingSummaryFunction(error: AttendanceRepositoryError): boolean {
  return Boolean(error && (
    ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code || '')
    || error.message?.includes('get_attendance_summary')
  ));
}

export function countSummaryRows(rows: Array<{ status?: string }>): AttendanceSummary {
  return rows.reduce<AttendanceSummary>((summary, row) => {
    if (row.status === 'hadir') summary.hadir += 1;
    if (row.status === 'sakit') summary.sakit += 1;
    if (row.status === 'izin') summary.izin += 1;
    if (row.status === 'alpha') summary.alpha += 1;
    summary.total += 1;
    return summary;
  }, { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 });
}

export function emptyAttendanceSummary(): AttendanceSummary {
  return { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 };
}

export function isDatabaseRow(value: unknown): value is DatabaseRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function toDatabaseRows(data: unknown): DatabaseRow[] {
  return Array.isArray(data) ? data.filter(isDatabaseRow) : [];
}

export function toAttendanceStatusRows(data: unknown): Array<{ status?: string }> {
  return toDatabaseRows(data).map((row) => (
    typeof row.status === 'string' ? { status: row.status } : {}
  ));
}
