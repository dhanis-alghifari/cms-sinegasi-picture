import { assertPasswordPolicy, createSecureTemporaryPassword, hashPassword } from '../../services/passwordService.js';
import {
  isMissingUsersSchemaError,
  isValidUsername,
  OPERATIONAL_USER_ROLES,
  STUDENT_ACCOUNT_ROLES,
  safeUserErrorMessage,
  userResetErrorCode,
  userUpdateErrorCode,
  USER_ROLES,
} from './users.helpers.js';
import type {
  UserCreateInput,
  UserListQuery,
  UserMutationResult,
  UserUpdateInput,
  UsersRepository,
  PasswordResetAuditContext,
  UserUpdateAuditContext,
} from './users.types.js';

export class UsersServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'UsersServiceError';
  }
}

function requiredText(value: unknown, field: string, minLength: number, maxLength = 200): string {
  if (typeof value !== 'string') throw new UsersServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  const text = value.trim();
  if (text.length < minLength || text.length > maxLength) throw new UsersServiceError(422, 'INVALID_INPUT', `${field} tidak valid.`);
  return text;
}

function requiredId(value: unknown, field: string): string {
  return requiredText(value, field, 1, 128);
}

function serviceFailure(error: unknown, fallback: string): never {
  const missingSchema = isMissingUsersSchemaError(error);
  throw new UsersServiceError(
    missingSchema ? 503 : 500,
    missingSchema ? 'USERS_SCHEMA_UNAVAILABLE' : 'USERS_OPERATION_FAILED',
    missingSchema ? 'Skema pengguna belum tersedia. Pastikan migration users sudah diterapkan di Supabase.' : safeUserErrorMessage(error, fallback),
  );
}

function resetFailure(error: unknown): never {
  if (isMissingUsersSchemaError(error)) {
    throw new UsersServiceError(
      503,
      'PASSWORD_RESET_SCHEMA_UNAVAILABLE',
      'Fitur reset password belum siap. Jalankan migration 040_admin_password_reset_atomic.sql di Supabase.',
    );
  }
  const code = userResetErrorCode(error);
  const mapped: Record<string, { status: number; message: string }> = {
    RESET_ACTOR_FORBIDDEN: { status: 403, message: 'Hanya Guru Pembina yang dapat mereset password akun.' },
    RESET_SELF_FORBIDDEN: { status: 409, message: 'Gunakan menu ubah password untuk akun yang sedang digunakan.' },
    RESET_OPERATION_REPLAY: { status: 409, message: 'Permintaan reset ini sudah diproses. Buat permintaan baru bila perlu mereset kembali.' },
    RESET_USER_NOT_FOUND: { status: 404, message: 'Pengguna tidak ditemukan.' },
    RESET_REASON_INVALID: { status: 422, message: 'Alasan reset password wajib 5 sampai 500 karakter.' },
    RESET_OPERATION_KEY_INVALID: { status: 422, message: 'X-Idempotency-Key wajib 8 sampai 128 karakter.' },
  };
  const result = code ? mapped[code] : undefined;
  if (result) throw new UsersServiceError(result.status, code as string, result.message);
  serviceFailure(error, 'Gagal mereset password pengguna.');
}

function updateFailure(error: unknown): never {
  if (isMissingUsersSchemaError(error)) {
    throw new UsersServiceError(
      503,
      'USERS_SCHEMA_UNAVAILABLE',
      'Fitur pembaruan akun belum siap. Jalankan migration 041_user_account_update_atomic.sql, 067_allow_student_committee_roles.sql, 076_student_account_boundaries.sql, dan 078_allow_student_treasurer_role.sql di Supabase.',
    );
  }
  const code = userUpdateErrorCode(error);
  const mapped: Record<string, { status: number; message: string }> = {
    USER_UPDATE_ACTOR_INVALID: { status: 503, message: 'Akun login belum terhubung ke identitas database yang valid.' },
    USER_UPDATE_ACTOR_FORBIDDEN: { status: 403, message: 'Aktor tidak memiliki izin untuk mengubah akun pengguna.' },
    USER_UPDATE_NOT_FOUND: { status: 404, message: 'Pengguna tidak ditemukan.' },
    USER_UPDATE_EMPTY: { status: 422, message: 'Tidak ada perubahan akun.' },
    USER_UPDATE_REASON_INVALID: { status: 422, message: 'Alasan perubahan wajib 5 sampai 500 karakter.' },
    USER_UPDATE_FIELD_INVALID: { status: 422, message: 'Kolom pembaruan akun tidak dikenali.' },
    USER_UPDATE_USERNAME_INVALID: { status: 422, message: 'Format username tidak valid.' },
    USER_UPDATE_NAME_INVALID: { status: 422, message: 'Nama pengguna tidak valid.' },
    USER_UPDATE_ROLE_INVALID: { status: 422, message: 'Role pengguna tidak valid.' },
    USER_UPDATE_STATUS_INVALID: { status: 422, message: 'Status akun harus berupa boolean.' },
    USER_LINKED_STUDENT_ROLE: { status: 422, message: 'Akun siswa hanya dapat memakai peran siswa. Teacher adalah role akun operasional.' },
    USER_UNLINKED_STUDENT_ROLE: { status: 422, message: 'Peran siswa hanya dapat diberikan saat akun ditautkan melalui halaman Data Siswa.' },
    USER_LINKED_STUDENT_NAME: { status: 422, message: 'Nama akun siswa mengikuti data siswa. Ubah nama melalui halaman Data Siswa.' },
    USER_INACTIVE_STUDENT: { status: 409, message: 'Aktifkan siswa sebagai siswa aktif terlebih dahulu sebelum mengaktifkan akunnya.' },
  };
  const result = code ? mapped[code] : undefined;
  if (result) throw new UsersServiceError(result.status, code as string, result.message);
  serviceFailure(error, 'Gagal memperbarui data pengguna.');
}

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async list(query: UserListQuery) {
    if (query.role && query.role !== 'all' && !USER_ROLES.has(query.role)) {
      throw new UsersServiceError(422, 'INVALID_ROLE', 'Filter role pengguna tidak valid.');
    }
    const result = await this.repository.list({ ...query, search: typeof query.search === 'string' ? query.search : undefined });
    if ('error' in result) serviceFailure(result.error, 'Gagal mengambil daftar pengguna.');
    return result.data;
  }

  async findById(id: string) {
    const result = await this.repository.findById(requiredId(id, 'id'));
    if ('error' in result) serviceFailure(result.error, 'Gagal mengambil data pengguna.');
    if (!result.data) throw new UsersServiceError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
    return result.data;
  }

  async create(input: UserCreateInput, actorId: string | null): Promise<{ data: UserMutationResult['data']; temporaryPassword: string }> {
    const username = requiredText(input.username, 'Username', 3, 30);
    if (!isValidUsername(username)) throw new UsersServiceError(422, 'INVALID_USERNAME', 'Format username tidak valid.');
    const nama = requiredText(input.nama, 'Nama', 2, 200);
    const role = requiredText(input.role, 'Role', 1, 32);
    if (!OPERATIONAL_USER_ROLES.has(role)) {
      throw new UsersServiceError(422, 'INVALID_ROLE', 'Akun siswa dibuat dari halaman Data Siswa. Pilih role akun operasional yang valid.');
    }
    const temporaryPassword = requiredText(input.password, 'Password', 1, 128);
    try {
      assertPasswordPolicy(temporaryPassword);
    } catch (error) {
      throw new UsersServiceError(422, 'PASSWORD_POLICY', error instanceof Error ? error.message : 'Password tidak valid.');
    }
    if (this.repositoryIsConfigured() && !actorId) {
      throw new UsersServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    }
    const result = await this.repository.create({ username, nama, role, passwordHash: await hashPassword(temporaryPassword), actorId });
    if ('error' in result) {
      if ((result.error as { code?: string })?.code === '23505') throw new UsersServiceError(409, 'DUPLICATE_USERNAME', safeUserErrorMessage(result.error, 'Username sudah digunakan.'));
      serviceFailure(result.error, 'Gagal membuat akun pengguna baru.');
    }
    return { data: result.data, temporaryPassword };
  }

  async update(id: string, input: UserUpdateInput, actorId: string | null, changeReason: string, auditContext?: UserUpdateAuditContext): Promise<UserMutationResult> {
    const userId = requiredId(id, 'id');
    requiredText(changeReason, 'Alasan perubahan', 5, 500);
    if (this.repositoryIsConfigured() && !actorId) throw new UsersServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const current = await this.findById(userId);
    const linked = await this.repository.findLinkedStudent(userId);
    if ('error' in linked) serviceFailure(linked.error, 'Gagal memeriksa relasi siswa.');
    if (linked.data && input.nama !== undefined && input.nama.trim() !== current.nama) {
      throw new UsersServiceError(422, 'LINKED_STUDENT_NAME', 'Nama akun siswa mengikuti data siswa. Ubah nama melalui halaman Data Siswa.');
    }
    if (linked.data && input.is_active === true && !linked.data.is_active) {
      throw new UsersServiceError(409, 'INACTIVE_STUDENT', 'Aktifkan siswa sebagai siswa aktif terlebih dahulu sebelum mengaktifkan akunnya.');
    }
    const changes: UserUpdateInput = {};
    if (input.username !== undefined) {
      const username = requiredText(input.username, 'Username', 3, 30);
      if (!isValidUsername(username)) {
        throw new UsersServiceError(422, 'INVALID_USERNAME', 'Format username tidak valid.');
      }
      changes.username = username;
    }
    if (input.nama !== undefined) changes.nama = requiredText(input.nama, 'Nama', 2, 200);
    if (input.role !== undefined) {
      if (!USER_ROLES.has(input.role)) throw new UsersServiceError(422, 'INVALID_ROLE', 'Role pengguna tidak valid.');
      if (
        !linked.data
        && STUDENT_ACCOUNT_ROLES.has(current.role)
        && !OPERATIONAL_USER_ROLES.has(current.role)
        && input.role !== current.role
      ) {
        throw new UsersServiceError(422, 'UNLINKED_STUDENT_ROLE', 'Akun siswa lama harus ditautkan ke data siswa sebelum perannya dapat dikelola.');
      }
      const permittedRoles = linked.data ? STUDENT_ACCOUNT_ROLES : OPERATIONAL_USER_ROLES;
      if (!permittedRoles.has(input.role) && input.role !== current.role) {
        if (linked.data) {
          throw new UsersServiceError(422, 'LINKED_STUDENT_ROLE', 'Akun siswa hanya dapat memakai peran siswa. Teacher adalah role akun operasional.');
        }
        throw new UsersServiceError(422, 'UNLINKED_STUDENT_ROLE', 'Peran siswa hanya dapat diberikan saat akun dibuat atau ditautkan melalui halaman Data Siswa.');
      }
      if (input.role !== current.role && permittedRoles.has(input.role)) changes.role = input.role;
    }
    if (input.is_active !== undefined) {
      if (typeof input.is_active !== 'boolean') throw new UsersServiceError(422, 'INVALID_STATUS', 'Status akun harus berupa boolean.');
      changes.is_active = input.is_active;
    }
    if (Object.keys(changes).length === 0) throw new UsersServiceError(422, 'EMPTY_UPDATE', 'Tidak ada perubahan akun.');
    const result = await this.repository.update(userId, changes, actorId, changeReason.trim(), auditContext);
    if ('error' in result) {
      if ((result.error as { code?: string })?.code === '23505') {
        throw new UsersServiceError(409, 'DUPLICATE_USERNAME', safeUserErrorMessage(result.error, 'Username sudah digunakan.'));
      }
      updateFailure(result.error);
    }
    if (!result.data) throw new UsersServiceError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
    return { data: result.data, previous: current };
  }

  async remove(id: string, actorId: string | null, changeReason: string): Promise<UserMutationResult> {
    const userId = requiredId(id, 'id');
    requiredText(changeReason, 'Alasan penghapusan', 5, 500);
    if (actorId && userId === actorId) throw new UsersServiceError(409, 'SELF_DELETE', 'Akun yang sedang digunakan tidak dapat dihapus.');
    if (this.repositoryIsConfigured() && !actorId) throw new UsersServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const current = await this.findById(userId);
    const linked = await this.repository.findLinkedStudent(userId);
    if ('error' in linked) serviceFailure(linked.error, 'Gagal memeriksa relasi siswa.');
    if (linked.data) throw new UsersServiceError(409, 'LINKED_STUDENT', 'Akun ini terhubung dengan siswa. Gunakan status Alumni agar histori siswa dan akun tetap konsisten.');
    const result = await this.repository.remove(userId);
    if ('error' in result) serviceFailure(result.error, 'Akun tidak dapat dihapus karena masih memiliki relasi data.');
    if (!result.data) throw new UsersServiceError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
    return { data: current, previous: current };
  }

  async resetPassword(id: string, actorId: string | null, changeReason: string, operationKey: string, auditContext?: PasswordResetAuditContext) {
    const userId = requiredId(id, 'id');
    const reason = requiredText(changeReason, 'Alasan reset password', 5, 500);
    const key = requiredText(operationKey, 'X-Idempotency-Key', 8, 128);
    if (this.repositoryIsConfigured() && !actorId) throw new UsersServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const temporaryPassword = createSecureTemporaryPassword('Reset');
    const result = await this.repository.resetPassword(userId, await hashPassword(temporaryPassword), actorId, reason, key, auditContext);
    if ('error' in result) resetFailure(result.error);
    if (!result.data) throw new UsersServiceError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
    return { userId, temporaryPassword, message: `Password sementara berhasil dibuat. Catat dan berikan kepada pengguna. Alasan: ${reason}`, data: result.data };
  }
}
