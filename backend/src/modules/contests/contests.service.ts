import {
  contestErrorMessage,
  cleanText,
  normalizeContestLevel,
  normalizeContestScope,
  normalizeContestStatus,
  toPublicContestStatus,
} from './contests.helpers.js';
import type { ContestListQuery, ContestRepository, ContestCreateInput, ContestUpdateInput, ContestSubmissionInput, ContestRecord } from './contests.types.js';
import { databaseErrorCode } from '../../shared/database/database.types.js';

export class ContestsServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) { super(message); this.name = 'ContestsServiceError'; }
}

function serviceError(error: unknown, fallback: string): never {
  const missingSchema = isMissingSchemaError(error);
  throw new ContestsServiceError(
    missingSchema ? 503 : 500,
    missingSchema ? 'CONTEST_SCHEMA_UNAVAILABLE' : 'CONTEST_READ_FAILED',
    contestErrorMessage(error, fallback),
  );
}

function isMissingSchemaError(error: unknown): boolean {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(databaseErrorCode(error) || '');
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  const text = cleanText(value, maxLength);
  if (!text) throw new ContestsServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  return text;
}

function getBusinessTodayDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

function validDate(value: string, mustBeFuture = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ContestsServiceError(422, 'INVALID_DATE', 'tanggal harus berupa tanggal YYYY-MM-DD.');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ContestsServiceError(422, 'INVALID_DATE', 'tanggal harus berupa tanggal kalender yang valid.');
  }
  if (mustBeFuture && value <= getBusinessTodayDate()) {
    throw new ContestsServiceError(422, 'INVALID_DEADLINE', 'Deadline pendaftaran harus besok atau tanggal setelahnya.');
  }
  return value;
}

function requiredYear(value: unknown, field = 'tahun_event'): number {
  const year = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new ContestsServiceError(422, 'INVALID_EVENT_YEAR', `${field} harus berada di antara 1900 dan 2200.`);
  }
  return year;
}

function optionalUrl(value: unknown, field: string): string | null {
  const text = cleanText(value, 2048);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
  } catch {
    throw new ContestsServiceError(422, 'INVALID_URL', `${field} harus berupa URL http atau https yang valid.`);
  }
  return text;
}

function optionalPlannedWorkCount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new ContestsServiceError(422, 'INVALID_PLANNED_WORK_COUNT', 'planned_work_count harus berupa bilangan bulat 1 sampai 1000.');
  }
  return count;
}

function optionalAcademicYear(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return new Date().getFullYear().toString();
  const year = cleanText(value, 4);
  if (!year || !/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2200) {
    throw new ContestsServiceError(422, 'INVALID_ACADEMIC_YEAR', 'academic_year harus berupa tahun 4 digit yang valid.');
  }
  return year;
}

function publicContract(input: ContestCreateInput | ContestUpdateInput): boolean {
  return input.nama_lomba !== undefined
    || input.kota !== undefined
    || input.tingkat !== undefined
    || input.tahun_event !== undefined
    || input.deadline !== undefined
    || input.status === 'buka'
    || input.status === 'proses_penjurian';
}

function getEventYear(input: ContestCreateInput, isPublicContract: boolean): number {
  if (isPublicContract) return requiredYear(input.tahun_event);
  if (input.tahun_event == null) return Number(optionalAcademicYear(input.academic_year));
  return requiredYear(input.tahun_event);
}

function getCreateErrorStatus(error: unknown): number {
  const code = databaseErrorCode(error);
  if (code === '23505') return 409;
  if (code === '22023') return 422;
  if (isMissingSchemaError(error)) return 503;
  return 400;
}

function getCreateErrorCode(error: unknown): string {
  const code = databaseErrorCode(error);
  if (isMissingSchemaError(error)) return 'CONTEST_SCHEMA_UNAVAILABLE';
  if (code === '22023') return 'INVALID_DEADLINE';
  return 'CONTEST_CREATE_FAILED';
}

function getUpdateErrorStatus(error: unknown, errorCode: string | undefined, rpcErrorCode?: string): number {
  const validationCodes = ['22023', '22P02', '22007'];
  if (validationCodes.includes(errorCode || '') || ['CONTEST_UPDATE_REASON_INVALID', 'CONTEST_UPDATE_EMPTY', 'CONTEST_UPDATE_FIELD_INVALID'].includes(rpcErrorCode || '')) return 422;
  if (rpcErrorCode === 'CONTEST_UPDATE_ACTOR_FORBIDDEN') return 403;
  if (rpcErrorCode === 'CONTEST_UPDATE_NOT_FOUND') return 404;
  if (isMissingSchemaError(error)) return 503;
  return 400;
}

function getUpdateErrorCode(error: unknown, errorCode: string | undefined, rpcErrorCode?: string): string {
  if (isMissingSchemaError(error)) return 'CONTEST_SCHEMA_UNAVAILABLE';
  if (rpcErrorCode) return rpcErrorCode;
  if (errorCode === '22023') return 'INVALID_DEADLINE';
  return 'CONTEST_UPDATE_FAILED';
}

function getSubmitErrorStatus(error: unknown): number {
  if (databaseErrorCode(error) === '23505') return 409;
  if (isMissingSchemaError(error)) return 503;
  return 400;
}

function getSubmitErrorCode(error: unknown): string {
  return isMissingSchemaError(error) ? 'CONTEST_SCHEMA_UNAVAILABLE' : 'CONTEST_SUBMISSION_FAILED';
}

export class ContestsService {
  constructor(private readonly repository: ContestRepository) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }
  async list(query: ContestListQuery) {
    if (query.tahun_event !== undefined) requiredYear(query.tahun_event, 'tahun_event');
    if (query.tingkat && query.tingkat !== 'all' && !normalizeContestScope(query.tingkat)) {
      throw new ContestsServiceError(422, 'INVALID_CONTEST_SCOPE', 'tingkat lomba tidak valid.');
    }
    const result = await this.repository.list({ ...query, search: cleanText(query.search, 100) || undefined });
    if ('error' in result) serviceError(result.error, 'Gagal memuat daftar lomba.');
    return result;
  }

  async summary() {
    const result = await this.repository.summary();
    if ('error' in result) serviceError(result.error, 'Gagal memuat ringkasan lomba.');
    return result.data;
  }

  async winRate(tahun?: string) {
    let year: number | undefined;
    if (tahun !== undefined) {
      year = Number.parseInt(tahun, 10);
      if (!Number.isInteger(year) || year < 1900 || year > 2200) {
        throw new ContestsServiceError(422, 'INVALID_YEAR', 'tahun harus berada di antara 1900 dan 2200.');
      }
    }
    const result = await this.repository.winRate(year);
    if ('error' in result) serviceError(result.error, 'Gagal memuat statistik win rate.');
    return result;
  }

  async create(input: ContestCreateInput, actorId: string | null) {
    const isPublicContract = publicContract(input);
    const nama = requiredText(input.nama ?? input.nama_lomba, isPublicContract ? 'nama_lomba' : 'nama', 200);
    const jenis = requiredText(input.jenis ?? (isPublicContract ? 'Festival / Perlombaan' : undefined), 'jenis', 120);
    const level = requiredText(normalizeContestLevel(input.level ?? input.tingkat), isPublicContract ? 'tingkat' : 'level', 32);
    const scope = isPublicContract ? normalizeContestScope(input.tingkat) : undefined;
    if (isPublicContract && !scope) {
      throw new ContestsServiceError(422, 'INVALID_CONTEST_SCOPE', 'tingkat lomba tidak valid.');
    }
    const tanggal = validDate(requiredText(input.tanggal ?? input.deadline, isPublicContract ? 'deadline' : 'tanggal', 10), isPublicContract);
    const status = normalizeContestStatus(input.status) || 'progres';
    const hasil = cleanText(input.hasil, 500);
    const statusPublic = isPublicContract ? toPublicContestStatus(input.status) : null;
    const kota = cleanText(input.kota, 120);
    const tahunEvent = getEventYear(input, isPublicContract);
    if (!actorId && this.repositoryIsConfigured()) {
      throw new ContestsServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    }
    const result = await this.repository.create({
      nama,
      jenis,
      level,
      tanggal,
      status,
      hasil,
      namaLomba: cleanText(input.nama_lomba, 200),
      penyelenggara: isPublicContract ? null : cleanText(input.penyelenggara, 120),
      kota,
      tingkat: scope ?? cleanText(input.tingkat, 32),
      deadline: cleanText(input.deadline, 10),
      tahunEvent,
      statusPublic,
      websiteUrl: optionalUrl(input.website_url, 'website_url'),
      deskripsi: cleanText(input.deskripsi, 2000),
      plannedWorkCount: optionalPlannedWorkCount(input.planned_work_count),
      academicYear: optionalAcademicYear(input.academic_year),
      actorId,
    });
    if ('error' in result) {
      throw new ContestsServiceError(
        getCreateErrorStatus(result.error),
        getCreateErrorCode(result.error),
        contestErrorMessage(result.error, 'Gagal menambahkan lomba baru.'),
      );
    }
    return result.data;
  }

  async update(id: string, input: ContestUpdateInput, actorId: string | null, changeReason = '', auditContext?: { requestId?: string | null; operationId?: string | null; userAgent?: string | null }) {
    const contestId = requiredText(id, 'id', 64);
    if (!actorId && this.repositoryIsConfigured()) {
      throw new ContestsServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    }
    const normalizedChangeReason = cleanText(changeReason, 500);
    if (!normalizedChangeReason || normalizedChangeReason.length < 5) {
      throw new ContestsServiceError(422, 'CONTEST_UPDATE_REASON_REQUIRED', 'Alasan perubahan wajib diisi minimal 5 karakter.');
    }
    const changes: Partial<ContestRecord> = {};
    const isPublicContract = publicContract(input);
    if (input.nama !== undefined || input.nama_lomba !== undefined) {
      const value = requiredText(input.nama ?? input.nama_lomba, input.nama_lomba !== undefined ? 'nama_lomba' : 'nama', 200);
      changes.nama = value;
      if (input.nama_lomba !== undefined) changes.nama_lomba = value;
    }
    if (input.jenis !== undefined) changes.jenis = requiredText(input.jenis, 'jenis', 120);
    if (input.penyelenggara !== undefined) changes.penyelenggara = requiredText(input.penyelenggara, 'penyelenggara', 120);
    if (input.level !== undefined || input.tingkat !== undefined) {
      const value = requiredText(normalizeContestLevel(input.level ?? input.tingkat), input.tingkat !== undefined ? 'tingkat' : 'level', 32);
      changes.level = value;
      if (input.tingkat !== undefined) {
        const scope = normalizeContestScope(input.tingkat);
        if (!scope) throw new ContestsServiceError(422, 'INVALID_CONTEST_SCOPE', 'tingkat lomba tidak valid.');
        changes.tingkat = scope;
      }
    }
    if (input.tanggal !== undefined || input.deadline !== undefined) {
      const value = validDate(requiredText(input.tanggal ?? input.deadline, input.deadline !== undefined ? 'deadline' : 'tanggal', 10), input.deadline !== undefined);
      changes.tanggal = value;
      if (input.deadline !== undefined) changes.deadline = value;
    }
    if (input.kota !== undefined) changes.kota = cleanText(input.kota, 120);
    if (input.tahun_event !== undefined) changes.tahun_event = requiredYear(input.tahun_event);
    if (input.status !== undefined) {
      changes.status = normalizeContestStatus(input.status) || requiredText(input.status, 'status', 32);
      if (isPublicContract) changes.status_public = toPublicContestStatus(input.status);
    }
    if (input.hasil !== undefined) changes.hasil = cleanText(input.hasil, 500);
    if (input.website_url !== undefined) changes.website_url = optionalUrl(input.website_url, 'website_url');
    if (input.deskripsi !== undefined) changes.deskripsi = cleanText(input.deskripsi, 2000);
    if (input.planned_work_count !== undefined) changes.planned_work_count = optionalPlannedWorkCount(input.planned_work_count);
    if (input.academic_year !== undefined) changes.academic_year = optionalAcademicYear(input.academic_year);
    if (Object.keys(changes).length === 0) {
      throw new ContestsServiceError(422, 'EMPTY_UPDATE', 'Setidaknya satu field lomba harus diubah.');
    }
    const result = await this.repository.update(contestId, {
      changes,
      actorId,
      changeReason: normalizedChangeReason || 'Memperbarui data lomba',
      auditContext,
    });
    if ('error' in result) {
      const errorCode = databaseErrorCode(result.error);
      const errorMessage = String((result.error as { message?: unknown })?.message || '');
      const rpcErrorCode = [
        'CONTEST_UPDATE_ACTOR_INVALID',
        'CONTEST_UPDATE_ACTOR_FORBIDDEN',
        'CONTEST_UPDATE_EMPTY',
        'CONTEST_UPDATE_FIELD_INVALID',
        'CONTEST_UPDATE_NOT_FOUND',
        'CONTEST_UPDATE_REASON_INVALID',
      ].find((code) => errorMessage.includes(code));
      const rpcErrorMessage: Record<string, string> = {
        CONTEST_UPDATE_ACTOR_INVALID: 'Aktor perubahan lomba tidak valid.',
        CONTEST_UPDATE_ACTOR_FORBIDDEN: 'Akun Anda tidak berwenang memperbarui data lomba.',
        CONTEST_UPDATE_EMPTY: 'Setidaknya satu field lomba harus diubah.',
        CONTEST_UPDATE_FIELD_INVALID: 'Field perubahan lomba tidak diizinkan.',
        CONTEST_UPDATE_NOT_FOUND: 'Lomba tidak ditemukan.',
        CONTEST_UPDATE_REASON_INVALID: 'Alasan perubahan wajib diisi minimal 5 karakter.',
      };
      throw new ContestsServiceError(
        getUpdateErrorStatus(result.error, errorCode, rpcErrorCode),
        getUpdateErrorCode(result.error, errorCode, rpcErrorCode),
        (rpcErrorCode && rpcErrorMessage[rpcErrorCode]) || contestErrorMessage(result.error, 'Gagal memperbarui data lomba.'),
      );
    }
    if (!result.data) throw new ContestsServiceError(404, 'CONTEST_NOT_FOUND', 'Lomba tidak ditemukan.');
    return result.data;
  }

  async submit(input: ContestSubmissionInput, actorId: string | null) {
    const contestId = requiredText(input.contest_id, 'contest_id', 64);
    const isRichSubmission = input.judul_film !== undefined;
    const filmId = input.film_id ? requiredText(input.film_id, 'film_id', 64) : undefined;
    if (!filmId && !isRichSubmission) {
      throw new ContestsServiceError(422, 'INVALID_INPUT', 'film_id atau payload karya film wajib diisi.');
    }
    const judulFilm = isRichSubmission ? requiredText(input.judul_film, 'judul_film', 200) : undefined;
    const linkVideo = isRichSubmission ? optionalUrl(input.link_video, 'link_video') : null;
    if (isRichSubmission && !linkVideo) throw new ContestsServiceError(422, 'INVALID_INPUT', 'link_video wajib diisi.');
    const awardStatus = isRichSubmission ? requiredText(input.award_status, 'award_status', 32) : undefined;
    const sutradaraId = isRichSubmission ? requiredText(input.sutradara_id, 'sutradara_id', 64) : undefined;
    const crewMembers = (input.crew_members || []).map((member) => requiredText(member, 'crew_members', 120));
    const result = await this.repository.submit({
      contestId,
      filmId,
      judulFilm,
      sutradaraId,
      crewMembers,
      linkVideo: linkVideo ?? undefined,
      awardStatus,
      sertifikatUrl: optionalUrl(input.sertifikat_url, 'sertifikat_url'),
      actorId,
    });
    if ('error' in result) {
      throw new ContestsServiceError(
        getSubmitErrorStatus(result.error),
        getSubmitErrorCode(result.error),
        contestErrorMessage(result.error, 'Gagal mendaftarkan film ke lomba.'),
      );
    }
    return result.data;
  }
}
