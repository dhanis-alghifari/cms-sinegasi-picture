import type { JwtPayload } from '../../shared/auth/auth.types.js';
import { getCapabilities } from '../../middleware/capabilities.js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import { clearAuthStateCache } from '../../middleware/authMiddleware.js';
import { assertPasswordPolicy, hashPassword, verifyPassword } from '../../services/passwordService.js';
import { resolveDatabaseStudentId, resolveDatabaseUserId } from './auth.identity.js';
import type { AuthDatabaseUser, AuthRepository, LinkedStudent } from './auth.repository.js';

export const PASSWORD_SCHEMA_MIGRATION_MESSAGE = 'Skema ganti password belum terpasang. Jalankan migration 022_password_change_atomic.sql setelah migration 021_auth_session_hardening.sql di Supabase, lalu restart backend.';

export class AuthServiceError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export type AuthLoginResult = {
  payload: JwtPayload;
  user: Record<string, unknown>;
};

export type AuthPasswordChangeResult = {
  payload: JwtPayload;
  user: Record<string, unknown>;
  message: string;
  userId: string;
};

type MockUser = JwtPayload & { password: string };

const MOCK_USERS: Readonly<Record<string, MockUser>> = {
  guru_pembina: {
    userId: 'usr-01', username: 'guru_pembina', password: 'guru123',
    role: 'teacher', isFirstLogin: false,
  },
  ketua_budi: {
    userId: 'usr-02', username: 'ketua_budi', password: 'ketua123',
    role: 'leader', isFirstLogin: false, studentId: 'std-1001',
  },
  member_siswa: {
    userId: 'usr-10', username: 'member_siswa', password: 'siswa123',
    role: 'member', isFirstLogin: true, studentId: 'std-1010',
  },
};

function isMissingPasswordSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(error.code || '')
    || error.message?.includes('change_password_atomic') === true;
}

function formatAuthError(error: unknown, fallback: string): string {
  const databaseError = asDatabaseError(error);
  if (!databaseError) return fallback;
  if (databaseError.message?.trim()) {
    const message = databaseError.message.trim();
    if (!message.includes('{') && !/\b(SELECT|UPDATE|INSERT|DELETE)\b/i.test(message)) return message;
  }
  return fallback;
}

function getAuthVersion(user: AuthDatabaseUser): number | undefined {
  return user.auth_version == null ? undefined : Number(user.auth_version);
}

function createLoginResult(payload: JwtPayload, linkedStudent: LinkedStudent | null): AuthLoginResult {
  return {
    payload,
    user: {
      id: payload.userId,
      userId: payload.userId,
      username: payload.username,
      nama: payload.nama || payload.username,
      role: payload.role,
      capabilities: getCapabilities(payload.role),
      is_active: payload.isActive !== false,
      studentId: linkedStudent?.id || payload.studentId,
      is_first_login: payload.isFirstLogin,
      ...(payload.authVersion === undefined ? {} : { auth_version: payload.authVersion }),
    },
  };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly allowDevelopmentAuth: boolean,
  ) {}

  async login(username: string, password: string): Promise<AuthLoginResult> {
    if (this.repository.isConfigured()) {
      const { data: dbUser, error } = await this.repository.findUserForLogin(username);
      if (error || !dbUser || !dbUser.is_active) {
        throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
      }

      const verification = await verifyPassword(password, dbUser.password_hash);
      if (!verification.valid) {
        throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
      }

      if (verification.needsRehash && password.length >= 8) {
        const migratedHash = await hashPassword(password);
        // Password migration is best effort; the authenticated request remains
        // valid even if the legacy hash update is temporarily unavailable.
        await this.repository.updatePasswordHash?.(dbUser.id, migratedHash);
      }

      const { data: linkedStudent } = await this.repository.findLinkedStudent(dbUser.id);
      if (linkedStudent && !linkedStudent.is_active) {
        throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
      }

      const payload: JwtPayload = {
        userId: dbUser.id,
        username: dbUser.username,
        nama: dbUser.nama,
        role: dbUser.role as JwtPayload['role'],
        studentId: linkedStudent?.id,
        isFirstLogin: dbUser.is_first_login,
        ...(getAuthVersion(dbUser) === undefined ? {} : { authVersion: getAuthVersion(dbUser) }),
      };
      return createLoginResult(payload, linkedStudent);
    }

    if (!this.allowDevelopmentAuth) {
      throw new AuthServiceError(503, 'AUTHENTICATION_UNAVAILABLE', 'Layanan login belum dikonfigurasi oleh administrator.');
    }

    const mockUser = MOCK_USERS[username];
    if (!mockUser || mockUser.password !== password) {
      throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
    }

    const databaseUserId = await resolveDatabaseUserId(mockUser);
    const databaseStudentId = await resolveDatabaseStudentId(mockUser, databaseUserId);
    const payload: JwtPayload = {
      userId: databaseUserId || mockUser.userId,
      username: mockUser.username,
      nama: mockUser.username,
      role: mockUser.role,
      studentId: databaseStudentId || undefined,
      isFirstLogin: mockUser.isFirstLogin,
    };
    return createLoginResult(payload, databaseStudentId ? { id: databaseStudentId, is_active: true } : null);
  }

  async getSession(user: JwtPayload): Promise<Record<string, unknown>> {
    let studentId = user.studentId;
    if (this.repository.isConfigured() && /^[0-9a-fA-F-]{36}$/.test(user.userId)) {
      const { data: linkedStudent, error } = await this.repository.findLinkedStudent(user.userId);
      if (error) throw new AuthServiceError(503, 'SESSION_UNAVAILABLE', 'Sesi belum dapat diverifikasi. Coba lagi.');
      if (linkedStudent && linkedStudent.is_active === false) {
        throw new AuthServiceError(401, 'ACCOUNT_INACTIVE', 'Akun siswa tidak aktif. Silakan login kembali.');
      }
      studentId = linkedStudent?.id;
    }
    return {
      id: user.userId,
      username: user.username,
      nama: user.nama || user.username,
      role: user.role,
      capabilities: getCapabilities(user.role),
      is_first_login: user.isFirstLogin,
      is_active: user.isActive !== false,
      studentId,
      ...(user.authVersion === undefined ? {} : { auth_version: user.authVersion }),
    };
  }

  async changePassword(user: JwtPayload, body: Record<string, unknown>): Promise<AuthPasswordChangeResult> {
    if (!this.repository.isConfigured()) {
      throw new AuthServiceError(503, 'DATABASE_UNAVAILABLE', 'Ganti password membutuhkan koneksi database aktif.');
    }
    if (!/^[0-9a-fA-F-]{36}$/.test(user.userId)) {
      throw new AuthServiceError(401, 'INVALID_SESSION', 'Sesi akun tidak valid. Silakan login kembali.');
    }

    const currentPassword = this.getString(body.current_password ?? body.currentPassword);
    const newPassword = this.getString(body.new_password ?? body.newPassword);
    const confirmPassword = this.getString(body.confirm_password ?? body.confirmPassword);
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new AuthServiceError(400, 'PASSWORD_FIELDS_REQUIRED', 'Password saat ini, password baru, dan konfirmasi wajib diisi.');
    }
    try {
      assertPasswordPolicy(newPassword);
    } catch (error) {
      throw new AuthServiceError(400, 'PASSWORD_POLICY', error instanceof Error ? error.message : 'Password baru tidak valid.');
    }
    if (newPassword !== confirmPassword) {
      throw new AuthServiceError(400, 'PASSWORD_MISMATCH', 'Konfirmasi password tidak cocok.');
    }
    if (newPassword === currentPassword) {
      throw new AuthServiceError(400, 'PASSWORD_REUSE', 'Password baru harus berbeda dari password saat ini.');
    }

    const { data: dbUser, error: readError } = await this.repository.findUserById(user.userId);
    if (readError || !dbUser || !dbUser.is_active) {
      throw new AuthServiceError(401, 'ACCOUNT_INACTIVE', 'Akun tidak dapat digunakan.');
    }
    const verification = await verifyPassword(currentPassword, dbUser.password_hash);
    if (!verification.valid) {
      throw new AuthServiceError(400, 'CURRENT_PASSWORD_INVALID', 'Password saat ini salah.');
    }
    const databaseUserId = await resolveDatabaseUserId(user);
    const expectedAuthVersion = getAuthVersion(dbUser);
    if (!databaseUserId || expectedAuthVersion === undefined) {
      throw new AuthServiceError(503, 'PASSWORD_SCHEMA_UNAVAILABLE', PASSWORD_SCHEMA_MIGRATION_MESSAGE);
    }

    const passwordHash = await hashPassword(newPassword);
    const { data: changedUserData, error } = await this.repository.changePasswordAtomic({
      userId: dbUser.id,
      passwordHash,
      updatedBy: databaseUserId,
      expectedAuthVersion,
    });
    const changedUser = changedUserData as {
      nama: string;
      is_active: boolean;
      is_first_login: boolean;
      auth_version: number;
    } | null;
    if (error || !changedUser) {
      if (isMissingPasswordSchemaError(error)) {
        throw new AuthServiceError(503, 'PASSWORD_SCHEMA_UNAVAILABLE', PASSWORD_SCHEMA_MIGRATION_MESSAGE);
      }
      if (error?.code === 'P0001' && error.message?.includes('Sesi keamanan berubah')) {
        clearAuthStateCache(dbUser.id);
        throw new AuthServiceError(401, 'SESSION_REVOKED', 'Sesi keamanan berubah. Silakan login kembali.');
      }
      throw new AuthServiceError(400, 'PASSWORD_CHANGE_FAILED', formatAuthError(error, 'Gagal mengubah password.'));
    }

    clearAuthStateCache(dbUser.id);
    const payload: JwtPayload = {
      ...user,
      isFirstLogin: false,
      authVersion: Number(changedUser.auth_version),
    };
    return {
      payload,
      user: {
        id: user.userId,
        username: user.username,
        nama: changedUser.nama,
      role: user.role,
      capabilities: getCapabilities(user.role),
        is_first_login: false,
        is_active: changedUser.is_active,
        studentId: user.studentId,
        auth_version: payload.authVersion,
      },
      message: 'Password berhasil diubah. Sesi Anda sudah diperbarui.',
      userId: user.userId,
    };
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
