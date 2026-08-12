import type {
  LinkedStudent,
  UserAccount,
  UserListQuery,
  UserMemoryState,
  UserRole,
} from './users.types.js';
import { USER_ROLE_VALUES } from './users.types.js';

export const USER_ROLES: ReadonlySet<string> = new Set(USER_ROLE_VALUES);
export const OPERATIONAL_USER_ROLES: ReadonlySet<string> = new Set(
  USER_ROLE_VALUES.filter((role) => role !== 'member'),
);

export const USER_SELECT = 'id,username,nama,role,is_active,is_first_login,created_at,updated_at,created_by,updated_by';

export function createUsersMemoryState(): UserMemoryState {
  return {
    users: [],
    linkedStudents: [],
    passwordHashes: new Map(),
    passwordResetOperations: new Set(),
  };
}

export function parseUserPagination(query: UserListQuery) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize) || 20)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function sanitizeUserSearch(value: string | undefined): string {
  return (value || '')
    .trim()
    .replace(/[%,_().\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

export function isValidUsername(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{3,30}$/.test(value.trim());
}

export function mapUserRow(row: Record<string, unknown>): UserAccount {
  return {
    id: String(row.id),
    username: String(row.username),
    nama: String(row.nama),
    role: String(row.role),
    is_first_login: row.is_first_login === true,
    is_active: row.is_active !== false,
    created_at: String(row.created_at),
    ...(row.updated_at == null ? {} : { updated_at: String(row.updated_at) }),
    ...(row.created_by == null ? {} : { created_by: String(row.created_by) }),
    ...(row.updated_by == null ? {} : { updated_by: String(row.updated_by) }),
  };
}

export function mapMemoryUser(user: UserAccount): UserAccount {
  return { ...user };
}

export function isMissingUsersSchemaError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  return Boolean(candidate && (
    ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(candidate.code || '')
    || candidate.message?.toLowerCase().includes('users')
    || candidate.message?.toLowerCase().includes('reset_user_password_atomic')
    || candidate.message?.toLowerCase().includes('password_reset_operations')
    || candidate.message?.toLowerCase().includes('update_user_account_atomic')
    || candidate.message?.toLowerCase().includes('access_role_permissions')
  ));
}

export function safeUserErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { code?: string } | null | undefined;
  if (candidate?.code === '23505') return 'Username ini sudah digunakan oleh pengguna lain.';
  if (candidate?.code === '23503') return 'Akun tidak dapat dihapus karena masih memiliki relasi data.';
  return fallback;
}

export function userResetErrorCode(error: unknown): string | null {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  const message = candidate?.message || '';
  const match = message.match(/\b(RESET_[A-Z_]+)\b/);
  return match?.[1] || (candidate?.code?.startsWith('RESET_') ? candidate.code : null);
}

export function userUpdateErrorCode(error: unknown): string | null {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  const message = candidate?.message || '';
  const match = message.match(/\b(USER_[A-Z_]+|USER_LINKED_STUDENT_[A-Z]+|USER_INACTIVE_STUDENT)\b/);
  return match?.[1] || (candidate?.code?.startsWith('USER_') ? candidate.code : null);
}

export function linkedStudentFor(state: UserMemoryState, id: string): LinkedStudent | null {
  return state.linkedStudents.find((student) => student.id === id) || null;
}

export type { LinkedStudent, UserRole };
