import {
  isClassLevel,
  isMissingClassesSchemaError,
  safeClassErrorMessage,
  CLASS_LEVELS,
} from './classes.helpers.js';
import type { ClassCreateInput, ClassListQuery, ClassUpdateInput, ClassesRepository } from './classes.types.js';

export class ClassesServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'ClassesServiceError';
  }
}

function textValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new ClassesServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  const text = value.trim();
  if (text.length === 0 || text.length > maxLength) throw new ClassesServiceError(422, 'INVALID_INPUT', `${field} wajib diisi dan maksimal ${maxLength} karakter.`);
  return text;
}

function classLevel(value: unknown): string {
  const level = textValue(value, 'Tingkat', 8);
  if (!CLASS_LEVELS.has(level)) throw new ClassesServiceError(422, 'INVALID_LEVEL', 'Tingkat kelas harus X, XI, atau XII.');
  return level;
}

function classId(value: unknown): string {
  return textValue(value, 'id', 128);
}

function mapRepositoryError(error: unknown, fallbackStatus: number, fallbackMessage: string): ClassesServiceError {
  const candidate = error as { code?: string } | null | undefined;
  if (candidate?.code === '23505') return new ClassesServiceError(409, 'CLASS_CONFLICT', safeClassErrorMessage(error, 'Nama kelas tersebut sudah digunakan.'));
  if (candidate?.code === 'NOT_FOUND') return new ClassesServiceError(404, 'CLASS_NOT_FOUND', 'Kelas tidak ditemukan.');
  if (isMissingClassesSchemaError(error)) return new ClassesServiceError(503, 'CLASSES_SCHEMA_UNAVAILABLE', 'Skema kelas belum tersedia. Jalankan migration classes terlebih dahulu.');
  return new ClassesServiceError(fallbackStatus, 'CLASS_OPERATION_FAILED', fallbackMessage);
}

export class ClassesService {
  constructor(private readonly repository: ClassesRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async list(query: ClassListQuery) {
    if (query.tingkat && query.tingkat !== 'all' && !isClassLevel(query.tingkat)) {
      throw new ClassesServiceError(422, 'INVALID_LEVEL', 'Filter tingkat kelas tidak valid.');
    }
    const result = await this.repository.list(query);
    if ('error' in result) throw mapRepositoryError(result.error, 500, 'Gagal mengambil daftar kelas.');
    return result.data;
  }

  async listActiveOptions() {
    const result = await this.repository.listActiveOptions();
    if ('error' in result) throw mapRepositoryError(result.error, 500, 'Gagal mengambil pilihan kelas.');
    return result.data;
  }

  async create(input: ClassCreateInput, actorId: string | null) {
    const normalized: ClassCreateInput = {
      nama_kelas: textValue(input.nama_kelas, 'Nama kelas', 120),
      tingkat: classLevel(input.tingkat),
    };
    if (this.repositoryIsConfigured() && !actorId) throw new ClassesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const result = await this.repository.create({ ...normalized, actorId });
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal menambahkan kelas baru.');
    return result.data;
  }

  async update(id: string, input: ClassUpdateInput, actorId: string | null, changeReason: string) {
    const normalizedId = classId(id);
    if (changeReason.trim().length < 5 || changeReason.trim().length > 500) throw new ClassesServiceError(422, 'INVALID_CHANGE_REASON', 'Alasan perubahan minimal 5 karakter.');
    if (this.repositoryIsConfigured() && !actorId) throw new ClassesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const changes: ClassUpdateInput = {};
    if (input.nama_kelas !== undefined) changes.nama_kelas = textValue(input.nama_kelas, 'Nama kelas', 120);
    if (input.tingkat !== undefined) changes.tingkat = classLevel(input.tingkat);
    if (input.is_active !== undefined) {
      if (typeof input.is_active !== 'boolean') throw new ClassesServiceError(422, 'INVALID_STATUS', 'Status kelas harus berupa boolean.');
      changes.is_active = input.is_active;
    }
    if (Object.keys(changes).length === 0) throw new ClassesServiceError(422, 'EMPTY_UPDATE', 'Tidak ada perubahan kelas.');
    const result = await this.repository.update(normalizedId, changes, actorId);
    if ('error' in result) throw mapRepositoryError(result.error, 400, 'Gagal memperbarui data kelas.');
    if (!result.data) throw new ClassesServiceError(404, 'CLASS_NOT_FOUND', 'Kelas tidak ditemukan.');
    return result.data;
  }

  async deactivate(id: string, actorId: string | null, changeReason: string) {
    return this.update(id, { is_active: false }, actorId, changeReason);
  }
}
