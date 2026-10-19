import crypto from 'node:crypto';
import type { StudentOption, StudentRecord, StudentsMemoryState } from './students.types.js';

export const STUDENT_SELECT = 'id,user_id,nis,nama,kelas,peminatan,no_telepon,foto_url,is_active,created_at,updated_at,created_by,updated_by';
export const STUDENT_LIST_SELECT = 'id,user_id,nis,nama,kelas,peminatan,no_telepon,is_active,created_at,updated_at,created_by,updated_by';
export const STUDENT_PAGE_SIZE_MAX = 100;
export const STUDENT_PAGE_MAX = 10_000;
export const STUDENT_OPTIONS_LIMIT_MAX = 20;
export const STUDENT_CLASS_LEVELS = new Set(['X', 'XI', 'XII']);
export const STUDENT_PEMINATAN = new Set(['kamera', 'editing', 'naskah']);

export function createStudentsMemoryState(): StudentsMemoryState {
  return { students: [], accounts: [] };
}

export function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value));
}

export function normalizeStudentUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function normalizeWhatsAppPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  const digits = compact.startsWith('+') ? compact.slice(1) : compact;
  const international = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  if (!/^628[1-9]\d{7,10}$/.test(international)) return null;
  return `+${international}`;
}

export function sanitizeStudentSearch(value: string | undefined): string {
  return (value || '')
    .trim()
    .replace(/[%,_().\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

export function parseStudentPagination(pageValue?: number, pageSizeValue?: number) {
  const rawPage = Number.isFinite(pageValue) ? Math.floor(pageValue as number) : 1;
  const rawPageSize = Number.isFinite(pageSizeValue) ? Math.floor(pageSizeValue as number) : 50;
  const page = Math.min(STUDENT_PAGE_MAX, Math.max(1, rawPage));
  const pageSize = Math.min(STUDENT_PAGE_SIZE_MAX, Math.max(1, rawPageSize));
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function parseStudentOptionsLimit(value?: number): number {
  const parsed = Number.isFinite(value) ? Math.floor(value as number) : 20;
  return Math.min(STUDENT_OPTIONS_LIMIT_MAX, Math.max(1, parsed));
}

export function mapStudentRow(row: Record<string, unknown>): StudentRecord {
  return {
    id: String(row.id),
    ...(row.user_id == null ? {} : { user_id: String(row.user_id) }),
    nis: String(row.nis),
    nama: String(row.nama),
    kelas: String(row.kelas),
    ...(row.peminatan == null ? {} : { peminatan: String(row.peminatan) }),
    ...(row.no_telepon == null ? {} : { no_telepon: String(row.no_telepon) }),
    ...(row.foto_url == null ? {} : { foto_url: String(row.foto_url) }),
    is_active: row.is_active !== false,
    created_at: String(row.created_at || ''),
    ...(row.updated_at == null ? {} : { updated_at: String(row.updated_at) }),
    ...(row.created_by == null ? {} : { created_by: String(row.created_by) }),
    ...(row.updated_by == null ? {} : { updated_by: String(row.updated_by) }),
  };
}

export function mapStudentOption(row: StudentRecord | Record<string, unknown>): StudentOption {
  const student = 'id' in row && 'nis' in row && 'nama' in row && 'kelas' in row
    ? row as StudentRecord
    : mapStudentRow(row as Record<string, unknown>);
  return {
    id: student.id,
    nis: student.nis,
    nama: student.nama,
    kelas: student.kelas,
    label: student.nama,
    secondaryLabel: `${student.nis} • ${student.kelas}`,
  };
}

export function isMissingStudentsSchemaError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  return Boolean(candidate && (
    ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(candidate.code || '')
    || candidate.message?.toLowerCase().includes('student')
    || candidate.message?.toLowerCase().includes('create_student_with_account_atomic')
    || candidate.message?.toLowerCase().includes('create_student_with_account_v2')
    || candidate.message?.toLowerCase().includes('list_unlinked_student_accounts')
    || candidate.message?.toLowerCase().includes('link_existing_student_account_atomic')
    || candidate.message?.toLowerCase().includes('link_account_to_existing_student_atomic')
    || candidate.message?.toLowerCase().includes('provision_student_account_atomic')
    || candidate.message?.toLowerCase().includes('provision_student_account_v2')
    || candidate.message?.toLowerCase().includes('set_student_account_status_atomic')
    || candidate.message?.toLowerCase().includes('update_student_profile_atomic')
    || candidate.message?.toLowerCase().includes('update_student_profile_audited_atomic')
    || candidate.message?.toLowerCase().includes('purge_student_history_atomic')
  ));
}

export function safeStudentErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  if (candidate?.code === '23505') return 'NIS siswa atau username akun tersebut sudah digunakan.';
  if (candidate?.code === '22023' && candidate.message && !/[{}]/.test(candidate.message)) return candidate.message;
  return fallback;
}
