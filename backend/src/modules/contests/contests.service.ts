import {
  contestErrorMessage,
  cleanText,
  normalizeContestLevel,
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
  return ['42P01', '42703', 'PGRST205'].includes(databaseErrorCode(error) || '');
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  const text = cleanText(value, maxLength);
  if (!text) throw new ContestsServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  return text;
}

function validDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ContestsServiceError(422, 'INVALID_DATE', 'tanggal harus berupa tanggal YYYY-MM-DD.');
  }
  return value;
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

function publicContract(input: ContestCreateInput | ContestUpdateInput): boolean {
  return input.nama_lomba !== undefined
    || input.penyelenggara !== undefined
    || input.tingkat !== undefined
    || input.deadline !== undefined
    || input.status === 'buka'
    || input.status === 'proses_penjurian';
}

export class ContestsService {
  constructor(private readonly repository: ContestRepository) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }
  async list(query: ContestListQuery) {
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
    const jenis = requiredText(input.jenis ?? (isPublicContract ? 'Sinematografi' : undefined), 'jenis', 120);
    const level = requiredText(normalizeContestLevel(input.level ?? input.tingkat), isPublicContract ? 'tingkat' : 'level', 32);
    const tanggal = validDate(requiredText(input.tanggal ?? input.deadline, isPublicContract ? 'deadline' : 'tanggal', 10));
    const status = normalizeContestStatus(input.status) || 'progres';
    const hasil = cleanText(input.hasil, 500);
    const statusPublic = isPublicContract ? toPublicContestStatus(input.status) : null;
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
      penyelenggara: cleanText(input.penyelenggara, 120),
      tingkat: cleanText(input.tingkat, 32),
      deadline: cleanText(input.deadline, 10),
      statusPublic,
      websiteUrl: optionalUrl(input.website_url, 'website_url'),
      deskripsi: cleanText(input.deskripsi, 2000),
      actorId,
    });
    if ('error' in result) {
      throw new ContestsServiceError(
        databaseErrorCode(result.error) === '23505' ? 409 : isMissingSchemaError(result.error) ? 503 : 400,
        'CONTEST_CREATE_FAILED',
        contestErrorMessage(result.error, 'Gagal menambahkan lomba baru.'),
      );
    }
    return result.data;
  }

  async update(id: string, input: ContestUpdateInput, actorId: string | null) {
    const contestId = requiredText(id, 'id', 64);
    if (!actorId && this.repositoryIsConfigured()) {
      throw new ContestsServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
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
      if (input.tingkat !== undefined) changes.tingkat = requiredText(input.tingkat, 'tingkat', 32);
    }
    if (input.tanggal !== undefined || input.deadline !== undefined) {
      const value = validDate(requiredText(input.tanggal ?? input.deadline, input.deadline !== undefined ? 'deadline' : 'tanggal', 10));
      changes.tanggal = value;
      if (input.deadline !== undefined) changes.deadline = value;
    }
    if (input.status !== undefined) {
      changes.status = normalizeContestStatus(input.status) || requiredText(input.status, 'status', 32);
      if (isPublicContract) changes.status_public = toPublicContestStatus(input.status);
    }
    if (input.hasil !== undefined) changes.hasil = cleanText(input.hasil, 500);
    if (input.website_url !== undefined) changes.website_url = optionalUrl(input.website_url, 'website_url');
    if (input.deskripsi !== undefined) changes.deskripsi = cleanText(input.deskripsi, 2000);
    if (Object.keys(changes).length === 0) {
      throw new ContestsServiceError(422, 'EMPTY_UPDATE', 'Setidaknya satu field lomba harus diubah.');
    }
    const result = await this.repository.update(contestId, { changes, actorId });
    if ('error' in result) {
      throw new ContestsServiceError(isMissingSchemaError(result.error) ? 503 : 400, 'CONTEST_UPDATE_FAILED', contestErrorMessage(result.error, 'Gagal memperbarui data lomba.'));
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
        databaseErrorCode(result.error) === '23505' ? 409 : isMissingSchemaError(result.error) ? 503 : 400,
        'CONTEST_SUBMISSION_FAILED',
        contestErrorMessage(result.error, 'Gagal mendaftarkan film ke lomba.'),
      );
    }
    return result.data;
  }
}
