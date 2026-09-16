import { createTemporaryPassword, hashPassword } from '../../services/passwordService.js';
import {
  isMissingStudentsSchemaError,
  isUuid,
  normalizeStudentUsername,
  safeStudentErrorMessage,
  STUDENT_CLASS_LEVELS,
  STUDENT_PEMINATAN,
} from './students.helpers.js';
import type {
  StudentAccountOperationResult,
  StudentAccountRole,
  StudentCreateInput,
  StudentListQuery,
  StudentOptionsQuery,
  StudentRecord,
  StudentRepository,
  StudentUpdateInput,
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
  if (normalized && !/^(https?:\/\/|data:image\/)/i.test(normalized)) throw new StudentServiceError(422, 'INVALID_PHOTO_URL', 'URL foto harus berupa http(s) atau data:image.');
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
  const candidate = error as { code?: string } | null | undefined;
  if (candidate?.code === '23505') return new StudentServiceError(409, 'STUDENT_CONFLICT', safeStudentErrorMessage(error, 'NIS siswa atau username akun tersebut sudah digunakan.'));
  if (candidate?.code === 'P0002' || candidate?.code === 'STUDENT_NOT_FOUND') return new StudentNotFoundError();
  if (candidate?.code === 'DATABASE_REQUIRED') return new StudentServiceError(503, 'DATABASE_REQUIRED', 'Provisioning akun siswa membutuhkan koneksi database.');
  if (candidate?.code === 'EMPTY_RESULT') return new StudentServiceError(500, 'EMPTY_RESULT', 'Server gagal membaca hasil operasi siswa.');
  if (isMissingStudentsSchemaError(error)) return new StudentServiceError(503, 'STUDENTS_SCHEMA_UNAVAILABLE', 'Skema siswa atau fungsi provisioning belum tersedia. Jalankan migration 019_student_account_provisioning.sql dan 067_allow_student_committee_roles.sql.');
  return new StudentServiceError(fallbackStatus, 'STUDENT_OPERATION_FAILED', safeStudentErrorMessage(error, fallbackMessage));
}

function fullRepository(repository: StudentRepository): Required<Pick<StudentRepository, 'list' | 'listOptions' | 'createWithAccount' | 'provisionAccount' | 'updateStatus' | 'updateProfile'>> {
  const candidate = repository as StudentRepository & Record<string, unknown>;
  const methods = ['list', 'listOptions', 'createWithAccount', 'provisionAccount', 'updateStatus', 'updateProfile'] as const;
  for (const method of methods) {
    if (typeof candidate[method] !== 'function') throw new StudentServiceError(500, 'STUDENTS_MODULE_MISCONFIGURED', 'Modul siswa belum dikonfigurasi lengkap.');
  }
  return candidate as Required<Pick<StudentRepository, typeof methods[number]>>;
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

  async create(input: StudentCreateInput, actorId: string | null): Promise<{ data: StudentAccountOperationResult; temporaryPassword: string }> {
    const nis = text(input.nis, 'NIS', 1, 40);
    if (!/[a-z0-9]/i.test(nis)) throw new StudentServiceError(422, 'INVALID_NIS', 'NIS harus memiliki minimal satu huruf atau angka.');
    const nama = text(input.nama, 'Nama siswa', 2, 120);
    const kelas = text(input.kelas, 'Kelas', 1, 80);
    const peminatan = normalizePeminatan(input.peminatan);
    const noTelepon = optionalText(input.no_telepon, 'Nomor telepon', 40);
    const fotoUrl = normalizePhotoUrl(input.foto_url);
    const role = normalizeStudentAccountRole(input.role);
    if (this.repositoryIsConfigured() && !actorId) throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const temporaryPassword = createTemporaryPassword();
    const result = await fullRepository(this.repository).createWithAccount({
      nis, nama, kelas, peminatan, no_telepon: noTelepon, foto_url: fotoUrl,
      username: normalizeStudentUsername(nis), passwordHash: await hashPassword(temporaryPassword), actorId, role,
    });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal menyimpan siswa dan membuat akun.');
    return { data: result.data, temporaryPassword };
  }

  async provisionAccount(id: string, actorId: string | null, changeReason: string): Promise<{ data: StudentAccountOperationResult; temporaryPassword: string }> {
    const studentId = text(id, 'id siswa', 1, 128);
    if (!isUuid(studentId)) throw new StudentServiceError(422, 'INVALID_STUDENT_ID', 'ID siswa tidak valid.');
    if (changeReason.trim().length < 5 || changeReason.trim().length > 500) throw new StudentServiceError(422, 'INVALID_CHANGE_REASON', 'Alasan pembuatan akun minimal 5 karakter.');
    if (!this.repositoryIsConfigured()) throw new StudentServiceError(503, 'DATABASE_REQUIRED', 'Provisioning akun siswa membutuhkan koneksi database.');
    if (!actorId) throw new StudentServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const student = await this.getByIdentifier(studentId);
    if (!/[a-z0-9]/i.test(student.nis)) throw new StudentServiceError(422, 'INVALID_NIS', 'NIS siswa tidak dapat digunakan untuk membuat username otomatis.');
    if (student.user_id) throw new StudentServiceError(409, 'STUDENT_ACCOUNT_EXISTS', 'Siswa ini sudah memiliki akun.');
    const temporaryPassword = createTemporaryPassword();
    const result = await fullRepository(this.repository).provisionAccount({
      id: student.id, username: normalizeStudentUsername(student.nis), passwordHash: await hashPassword(temporaryPassword), actorId,
    });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal membuat akun siswa.');
    return { data: result.data, temporaryPassword };
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
      ...(input.nama !== undefined ? { nama: text(input.nama, 'Nama siswa', 2, 120) } : {}),
      ...(input.kelas !== undefined ? { kelas: text(input.kelas, 'Kelas', 1, 80) } : {}),
      ...(input.peminatan !== undefined ? { peminatan: normalizePeminatan(input.peminatan) } : {}),
      ...(input.no_telepon !== undefined ? { no_telepon: optionalText(input.no_telepon, 'Nomor telepon', 40) } : {}),
      ...(input.foto_url !== undefined ? { foto_url: normalizePhotoUrl(input.foto_url) } : {}),
    };
    if (changes.nama === undefined && changes.kelas === undefined) {
      changes.nama = previous.nama;
      changes.kelas = previous.kelas;
    }
    const result = await fullRepository(this.repository).updateProfile({ id: previous.id, changes, actorId });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal memperbarui profil siswa.');
    if (!result.data) throw new StudentNotFoundError();
    return { data: result.data, previous };
  }
}
