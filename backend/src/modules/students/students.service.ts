import crypto from 'node:crypto';
import { createTemporaryPassword, hashPassword } from '../../services/passwordService.js';
import { validateImageReference } from '../../shared/uploads/imageReference.js';
import {
  isMissingStudentsSchemaError,
  isUuid,
  normalizeStudentUsername,
  normalizeWhatsAppPhone,
  safeStudentErrorMessage,
  STUDENT_CLASS_LEVELS,
  STUDENT_PEMINATAN,
} from './students.helpers.js';
import type {
  StudentAccountOperationResult,
  StudentAccountOperationContext,
  StudentAccountLinkInput,
  StudentAccountLinkResult,
  StudentExistingProfileLinkInput,
  StudentAccountRole,
  StudentCreateInput,
  StudentListQuery,
  StudentOptionsQuery,
  StudentRecord,
  StudentPurgeResult,
  StudentRepository,
  StudentUpdateInput,
  UnlinkedStudentAccount,
} from './students.types.js';
import { STUDENT_ACCOUNT_ROLE_VALUES } from './students.types.js';

export class StudentServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'StudentServiceError';
  }
}

export class StudentNotFoundError extends StudentServiceError {
  constructor(message = 'Data siswa tidak ditemukan.') {
    super(404, 'STUDENT_NOT_FOUND', message);
    this.name = 'StudentNotFoundError';
  }
}

function text(value: unknown, field: string, minLength: number, maxLength: number): string {
  if (typeof value !== 'string') throw new StudentServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) throw new StudentServiceError(422, 'INVALID_INPUT', `${field} tidak valid.`);
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new StudentServiceError(422, 'INVALID_INPUT', `${field} tidak valid.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new StudentServiceError(422, 'INVALID_INPUT', `${field} maksimal ${maxLength} karakter.`);
  return normalized || undefined;
}

function normalizePeminatan(value: unknown): string | undefined {
  const normalized = optionalText(value, 'Peminatan', 32);
  if (normalized && !STUDENT_PEMINATAN.has(normalized)) throw new StudentServiceError(422, 'INVALID_PEMINATAN', 'Peminatan siswa tidak valid.');
  return normalized;
}

function normalizePhotoUrl(value: unknown): string | undefined {
  const normalized = optionalText(value, 'Foto siswa', 2_000_000);
  if (normalized && !validateImageReference(typeof value === 'string' ? value : normalized, {
    maxDecodedBytes: 1_500_000, maxLength: 2_000_000,
  }).valid) {
    throw new StudentServiceError(422, 'INVALID_PHOTO_URL', 'Foto harus berupa JPG, PNG, atau WebP base64 yang valid, atau URL http(s) tanpa kredensial.');
  }
  return normalized;
}

function normalizeStudentAccountRole(value: unknown): StudentAccountRole {
  const role = value === undefined ? 'member' : text(value, 'Peran akun siswa', 1, 32);
  if (!STUDENT_ACCOUNT_ROLE_VALUES.includes(role as StudentAccountRole)) {
    throw new StudentServiceError(422, 'INVALID_ACCOUNT_ROLE', 'Peran akun siswa tidak valid.');
  }
  return role as StudentAccountRole;
}

function mapRepositoryError(error: unknown, fallbackStatus = 500, fallbackMessage = 'Operasi data siswa gagal.'): StudentServiceError {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  if (candidate?.message?.includes('USERNAME_TAKEN') || candidate?.message?.includes('uq_users_username_normalized')) {
    return new StudentServiceError(409, 'USERNAME_TAKEN', 'Username sudah digunakan. Silakan pilih username lain.');
  }
  if (candidate?.code === 'STUDENT_OPERATION_KEY_REUSED' || candidate?.message?.includes('STUDENT_OPERATION_KEY_REUSED')) {
    return new StudentServiceError(409, 'IDEMPOTENCY_KEY_REUSED', 'Permintaan akun ini berubah setelah dikirim. Periksa status akun lalu coba lagi dengan formulir terbaru.');
  }
  if (candidate?.code === '23505') return new StudentServiceError(409, 'STUDENT_CONFLICT', safeStudentErrorMessage(error, 'NIS siswa atau username akun tersebut sudah digunakan.'));
  if (candidate?.code === 'P0002' || candidate?.code === 'STUDENT_NOT_FOUND') return new StudentNotFoundError();
  if (candidate?.code === 'DATABASE_REQUIRED') return new StudentServiceError(503, 'DATABASE_REQUIRED', 'Provisioning akun siswa membutuhkan koneksi database.');
  if (candidate?.code === 'EMPTY_RESULT') return new StudentServiceError(500, 'EMPTY_RESULT', 'Server gagal membaca hasil operasi siswa.');
  if (candidate?.code === 'STUDENT_ACCOUNT_NOT_ELIGIBLE' || candidate?.message?.includes('STUDENT_ACCOUNT_NOT_ELIGIBLE')) {
    return new StudentServiceError(409, 'STUDENT_ACCOUNT_NOT_ELIGIBLE', 'Akun tidak tersedia untuk ditautkan. Muat ulang daftar akun lalu pilih akun siswa yang belum terhubung.');
  }
  if (candidate?.code === 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' || candidate?.message?.includes('STUDENT_LINK_TARGET_NOT_ELIGIBLE')) {
    return new StudentServiceError(409, 'STUDENT_LINK_TARGET_NOT_ELIGIBLE', 'Akun atau profil siswa tidak tersedia untuk ditautkan. Pastikan keduanya aktif dan belum memiliki tautan akun.');
  }
  if (candidate?.code === 'STUDENT_ACTOR_FORBIDDEN' || candidate?.message?.includes('STUDENT_ACTOR_FORBIDDEN')) {
    return new StudentServiceError(403, 'STUDENT_ACTOR_FORBIDDEN', 'Akun tidak memiliki izin untuk mengelola siswa.');
  }
  if (candidate?.code === 'STUDENT_PURGE_ACTIVE' || candidate?.message?.includes('STUDENT_PURGE_ACTIVE')) {
    return new StudentServiceError(409, 'STUDENT_PURGE_ACTIVE', 'Siswa masih aktif. Nonaktifkan sebagai alumni terlebih dahulu sebelum menghapus data permanen.');
  }
  if (candidate?.code === 'STUDENT_PURGE_ACTOR_FORBIDDEN' || candidate?.message?.includes('STUDENT_PURGE_ACTOR_FORBIDDEN')) {
    return new StudentServiceError(403, 'STUDENT_PURGE_ACTOR_FORBIDDEN', 'Hanya Guru Pembina yang dapat menghapus data siswa secara permanen.');
  }
  if (isMissingStudentsSchemaError(error)) {
    return new StudentServiceError(
      503,
      'STUDENTS_SCHEMA_UNAVAILABLE',
      'Skema siswa atau fungsi akun belum tersedia. Minta pengelola memeriksa migrasi database siswa terbaru.',
    );
  }
  return new StudentServiceError(fallbackStatus, 'STUDENT_OPERATION_FAILED', safeStudentErrorMessage(error, fallbackMessage));
}

function fullRepository(repository: StudentRepository): Required<Pick<StudentRepository, 'list' | 'listOptions' | 'createWithAccount' | 'provisionAccount' | 'updateStatus' | 'updateProfile' | 'purge'>> {
  const candidate = repository as StudentRepository & Record<string, unknown>;
  const methods = ['list', 'listOptions', 'createWithAccount', 'provisionAccount', 'updateStatus', 'updateProfile', 'purge'] as const;
  for (const method of methods) {
    if (typeof candidate[method] !== 'function') throw new StudentServiceError(500, 'STUDENTS_MODULE_MISCONFIGURED', 'Modul siswa belum dikonfigurasi lengkap.');
  }
  return candidate as Required<Pick<StudentRepository, typeof methods[number]>>;
}

function operationContext(context: StudentAccountOperationContext): StudentAccountOperationContext {
  const operationKey = text(context.operationKey, 'Kunci operasi', 36, 36);
  if (!isUuid(operationKey)) throw new StudentServiceError(422, 'INVALID_IDEMPOTENCY_KEY', 'Kunci operasi akun tidak valid.');
  return {
    operationKey,
    changeReason: text(context.changeReason, 'Alasan perubahan', 5, 500),
    ...(context.requestId && isUuid(context.requestId) ? { requestId: context.requestId } : {}),
    ...(context.operationId && isUuid(context.operationId) ? { operationId: context.operationId } : {}),
    ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 500) } : {}),
  };
}

function accountRequestFingerprint(value: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function accountLinkRepository(repository: StudentRepository): Required<Pick<StudentRepository, 'listUnlinkedAccounts' | 'linkExistingAccount'>> {
  const candidate = repository as StudentRepository & Record<string, unknown>;
  if (typeof candidate.listUnlinkedAccounts !== 'function' || typeof candidate.linkExistingAccount !== 'function') {
    throw new StudentServiceError(500, 'STUDENTS_MODULE_MISCONFIGURED', 'Fitur pengaitan akun siswa belum dikonfigurasi lengkap.');
  }
  return candidate as Required<Pick<StudentRepository, 'listUnlinkedAccounts' | 'linkExistingAccount'>>;
}

function existingProfileLinkRepository(repository: StudentRepository): Required<Pick<StudentRepository, 'linkAccountToExistingProfile'>> {
  const candidate = repository as StudentRepository & Record<string, unknown>;
  if (typeof candidate.linkAccountToExistingProfile !== 'function') {
    throw new StudentServiceError(500, 'STUDENTS_MODULE_MISCONFIGURED', 'Fitur pengaitan akun ke profil siswa belum dikonfigurasi lengkap.');
  }
  return candidate as Required<Pick<StudentRepository, 'linkAccountToExistingProfile'>>;
}

export class StudentService {
  constructor(
    private readonly repository: StudentRepository,
    private readonly getFallbackStudents: () => ReadonlyArray<{ id: string; nis: string; nama: string } & Partial<StudentRecord>> = () => [],
  ) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async getByIdentifier(identifier: string): Promise<StudentRecord> {
    const normalized = text(identifier, 'id siswa', 1, 128);
    const { data, error } = await this.repository.findByIdentifier(normalized);
    if (error) throw mapRepositoryError(error, 500, 'Gagal mengambil data siswa.');
    if (data) return data as StudentRecord;
    if (!this.repository.isConfigured()) {
      const fallback = this.getFallbackStudents().find((item) => item.id === normalized || item.nis === normalized);
      if (fallback) return fallback as StudentRecord;
    }
    throw new StudentNotFoundError();
  }

  async getPhoto(id: string): Promise<string | null> {
    const normalized = text(id, 'id siswa', 1, 128);
    if (!this.repository.findPhoto) {
      throw new StudentServiceError(500, 'STUDENTS_MODULE_MISCONFIGURED', 'Fitur foto siswa belum dikonfigurasi lengkap.');
    }
    const { data, error } = await this.repository.findPhoto(normalized);
    if (error) throw mapRepositoryError(error, 500, 'Gagal memuat foto siswa.');
    return data?.foto_url ?? null;
  }

  async list(query: StudentListQuery) {
    if (query.kelas && query.kelas !== 'all' && !STUDENT_CLASS_LEVELS.has(query.kelas)) throw new StudentServiceError(422, 'INVALID_CLASS_LEVEL', 'Filter tingkat kelas tidak valid.');
    if (query.peminatan && query.peminatan !== 'all' && !STUDENT_PEMINATAN.has(query.peminatan)) throw new StudentServiceError(422, 'INVALID_PEMINATAN', 'Filter peminatan tidak valid.');
    const result = await fullRepository(this.repository).list(query);
    if ('error' in result) throw mapRepositoryError(result.error, 500, 'Gagal memuat daftar siswa.');
    return result.data;
  }

  async listOptions(query: StudentOptionsQuery) {
    const result = await fullRepository(this.repository).listOptions(query);
    if ('error' in result) throw mapRepositoryError(result.error, 500, 'Gagal memuat pilihan siswa.');
    return result.data;
  }

  async listUnlinkedAccounts(query: { search?: string; limit?: number }, actorId: string | null): Promise<UnlinkedStudentAccount[]> {
    if (!actorId) throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const search = optionalText(query.search, 'Pencarian akun', 100);
    const requestedLimit = Number(query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(20, Math.max(1, Math.floor(requestedLimit)))
      : 20;
    const result = await accountLinkRepository(this.repository).listUnlinkedAccounts({ search, limit, actorId });
    if ('error' in result) throw mapRepositoryError(result.error, 500, 'Gagal memuat akun siswa yang belum tertaut.');
    return result.data;
  }

  async create(input: StudentCreateInput, actorId: string | null, context: StudentAccountOperationContext): Promise<{ data: StudentAccountOperationResult; temporaryPassword?: string }> {
    const nis = text(input.nis, 'NIS', 1, 40);
    if (!/[a-z0-9]/i.test(nis)) throw new StudentServiceError(422, 'INVALID_NIS', 'NIS harus memiliki minimal satu huruf atau angka.');
    const nama = text(input.nama, 'Nama siswa', 2, 120);
    const kelas = text(input.kelas, 'Kelas', 1, 80);
    const peminatan = normalizePeminatan(input.peminatan);
    const username = normalizeStudentUsername(text(input.username, 'Username', 3, 30));
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new StudentServiceError(422, 'INVALID_USERNAME', 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung (3–30 karakter).');
    const phoneInput = text(input.no_telepon, 'Nomor WhatsApp', 1, 40);
    const noTelepon = normalizeWhatsAppPhone(phoneInput);
    if (!noTelepon) throw new StudentServiceError(422, 'INVALID_WHATSAPP_NUMBER', 'Masukkan nomor WhatsApp Indonesia yang valid, misalnya 081234567890 atau +6281234567890.');
    const fotoUrl = normalizePhotoUrl(input.foto_url);
    const role = normalizeStudentAccountRole(input.role);
    const operation = operationContext(context);
    if (this.repositoryIsConfigured() && !actorId) throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const temporaryPassword = createTemporaryPassword();
    const requestFingerprint = accountRequestFingerprint({ nis, nama, kelas, peminatan: peminatan ?? null, noTelepon, fotoUrl: fotoUrl ?? null, username, role });
    const result = await fullRepository(this.repository).createWithAccount({
      nis, nama, kelas, peminatan, no_telepon: noTelepon, foto_url: fotoUrl, username,
      passwordHash: await hashPassword(temporaryPassword), actorId, role, requestFingerprint, ...operation,
    });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal menyimpan siswa dan membuat akun.');
    return { data: result.data, ...(result.data.account.operation_replayed ? {} : { temporaryPassword }) };
  }

  async linkExistingAccount(
    input: StudentAccountLinkInput,
  ): Promise<{ data: StudentAccountLinkResult }> {
    const userId = text(input.userId, 'Akun siswa', 36, 36);
    if (!isUuid(userId)) throw new StudentServiceError(422, 'INVALID_ACCOUNT_ID', 'ID akun siswa tidak valid.');
    if (!input.actorId) throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const actorId = text(input.actorId, 'Aktor', 1, 128);
    if (this.repositoryIsConfigured() && !isUuid(actorId)) {
      throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    }
    if (actorId === userId) throw new StudentServiceError(409, 'SELF_LINK_FORBIDDEN', 'Akun yang sedang digunakan tidak dapat ditautkan sebagai akun siswa lain.');
    const changeReason = text(input.changeReason, 'Alasan perubahan', 5, 500);
    const nis = text(input.nis, 'NIS', 1, 40);
    if (!/[a-z0-9]/i.test(nis)) throw new StudentServiceError(422, 'INVALID_NIS', 'NIS harus memiliki minimal satu huruf atau angka.');
    const nama = text(input.nama, 'Nama siswa', 2, 120);
    const kelas = text(input.kelas, 'Kelas', 1, 80);
    const peminatan = normalizePeminatan(input.peminatan);
    const noTelepon = optionalText(input.no_telepon, 'Nomor telepon', 40);
    const fotoUrl = normalizePhotoUrl(input.foto_url);
    const result = await accountLinkRepository(this.repository).linkExistingAccount({
      userId, actorId, changeReason, nis, nama, kelas,
      peminatan, no_telepon: noTelepon, foto_url: fotoUrl,
    });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal menautkan akun lama ke data siswa.');
    return { data: result.data };
  }

  async linkAccountToExistingProfile(input: StudentExistingProfileLinkInput): Promise<{ data: StudentAccountLinkResult }> {
    const studentId = text(input.studentId, 'ID siswa', 36, 36);
    const userId = text(input.userId, 'Akun siswa', 36, 36);
    const actorId = text(input.actorId, 'Aktor', 1, 128);
    const changeReason = text(input.changeReason, 'Alasan perubahan', 5, 500);
    if (!isUuid(studentId) || !isUuid(userId)) throw new StudentServiceError(422, 'INVALID_LINK_TARGET', 'ID siswa atau akun tidak valid.');
    if (this.repositoryIsConfigured() && !isUuid(actorId)) {
      throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    }
    if (actorId === userId) throw new StudentServiceError(409, 'SELF_LINK_FORBIDDEN', 'Akun yang sedang digunakan tidak dapat ditautkan sebagai akun siswa lain.');
    const result = await existingProfileLinkRepository(this.repository).linkAccountToExistingProfile({ studentId, userId, actorId, changeReason });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal menautkan akun ke profil siswa.');
    return { data: result.data };
  }

  async provisionAccount(
    id: string,
    actorId: string | null,
    input: { username: string; phoneNumber: string } & StudentAccountOperationContext,
  ): Promise<{ data: StudentAccountOperationResult; temporaryPassword?: string }> {
    const studentId = text(id, 'id siswa', 1, 128);
    if (!isUuid(studentId)) throw new StudentServiceError(422, 'INVALID_STUDENT_ID', 'ID siswa tidak valid.');
    if (!this.repositoryIsConfigured()) throw new StudentServiceError(503, 'DATABASE_REQUIRED', 'Provisioning akun siswa membutuhkan koneksi database.');
    if (!actorId) throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const username = normalizeStudentUsername(text(input.username, 'Username', 3, 30));
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new StudentServiceError(422, 'INVALID_USERNAME', 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung (3–30 karakter).');
    const phoneInput = text(input.phoneNumber, 'Nomor WhatsApp', 1, 40);
    const phoneNumber = normalizeWhatsAppPhone(phoneInput);
    if (!phoneNumber) throw new StudentServiceError(422, 'INVALID_WHATSAPP_NUMBER', 'Masukkan nomor WhatsApp Indonesia yang valid, misalnya 081234567890 atau +6281234567890.');
    const operation = operationContext(input);
    const temporaryPassword = createTemporaryPassword();
    const requestFingerprint = accountRequestFingerprint({ studentId, username, phoneNumber });
    const result = await fullRepository(this.repository).provisionAccount({
      id: studentId, username, phoneNumber, passwordHash: await hashPassword(temporaryPassword), actorId, requestFingerprint, ...operation,
    });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal membuat akun siswa.');
    return { data: result.data, ...(result.data.account.operation_replayed ? {} : { temporaryPassword }) };
  }

  async update(id: string, input: StudentUpdateInput, actorId: string | null, changeReason: string, allowStatus: boolean): Promise<{ data: StudentRecord; previous: StudentRecord }> {
    const studentId = text(id, 'id siswa', 1, 128);
    if (changeReason.trim().length < 5 || changeReason.trim().length > 500) throw new StudentServiceError(422, 'INVALID_CHANGE_REASON', 'Alasan perubahan minimal 5 karakter wajib diisi.');
    if (this.repositoryIsConfigured() && !actorId) throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const previous = await this.getByIdentifier(studentId);
    const hasStatus = input.is_active !== undefined;
    const profileKeys = ['nama', 'kelas', 'peminatan', 'no_telepon', 'foto_url'] as const;
    const hasProfile = profileKeys.some((key) => Object.prototype.hasOwnProperty.call(input, key));
    if (hasStatus && !allowStatus) throw new StudentServiceError(403, 'STATUS_CHANGE_FORBIDDEN', 'Hanya Guru Pembina yang dapat mengubah status aktif/alumni siswa.');
    if (hasStatus && hasProfile) throw new StudentServiceError(422, 'MIXED_STUDENT_UPDATE', 'Perubahan profil dan status aktif dilakukan dalam tindakan terpisah.');
    if (hasStatus) {
      if (typeof input.is_active !== 'boolean') throw new StudentServiceError(422, 'INVALID_STATUS', 'Status aktif siswa harus berupa boolean.');
      const result = await fullRepository(this.repository).updateStatus({ id: previous.id, isActive: input.is_active, actorId });
      if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal memperbarui status siswa.');
      if (!result.data) throw new StudentNotFoundError();
      return { data: result.data, previous };
    }
    if (!hasProfile) throw new StudentServiceError(422, 'EMPTY_UPDATE', 'Tidak ada perubahan profil siswa.');
    const changes: StudentUpdateInput = {
      // The profile RPC replaces these columns; omitted fields must keep their values.
      nama: previous.nama,
      kelas: previous.kelas,
      peminatan: previous.peminatan,
      no_telepon: previous.no_telepon,
      foto_url: previous.foto_url,
      ...(input.nama !== undefined ? { nama: text(input.nama, 'Nama siswa', 2, 120) } : {}),
      ...(input.kelas !== undefined ? { kelas: text(input.kelas, 'Kelas', 1, 80) } : {}),
      ...(input.peminatan !== undefined ? { peminatan: normalizePeminatan(input.peminatan) } : {}),
      ...(input.no_telepon !== undefined ? { no_telepon: optionalText(input.no_telepon, 'Nomor telepon', 40) } : {}),
      ...(input.foto_url !== undefined ? { foto_url: normalizePhotoUrl(input.foto_url) } : {}),
    };
    const result = await fullRepository(this.repository).updateProfile({ id: previous.id, changes, actorId, changeReason: changeReason.trim() });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal memperbarui profil siswa.');
    if (!result.data) throw new StudentNotFoundError();
    return { data: result.data, previous };
  }

  async purge(id: string, actorId: string | null, changeReason: string): Promise<StudentPurgeResult> {
    const studentId = text(id, 'id siswa', 1, 128);
    const reason = text(changeReason, 'Alasan penghapusan', 5, 500);
    if (!isUuid(studentId)) throw new StudentServiceError(422, 'INVALID_STUDENT_ID', 'ID siswa tidak valid.');
    if (this.repositoryIsConfigured() && !actorId) {
      throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    }
    const previous = await this.getByIdentifier(studentId);
    if (previous.is_active) {
      throw new StudentServiceError(409, 'STUDENT_PURGE_ACTIVE', 'Siswa masih aktif. Nonaktifkan sebagai alumni terlebih dahulu sebelum menghapus data permanen.');
    }
    const result = await fullRepository(this.repository).purge({ id: previous.id, actorId: actorId || '', changeReason: reason });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal menghapus data siswa secara permanen.');
    return result.data;
  }
}
