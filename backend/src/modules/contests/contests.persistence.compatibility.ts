import { databaseErrorCode } from '../../shared/database/database.types.js';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import {
  toPublicContestLevel,
  toPublicContestStatus,
} from './contests.helpers.js';
import type {
  ContestCreatePersistenceInput,
  ContestRecord,
  ContestSubmissionPersistenceInput,
  ContestSubmissionRecord,
} from './contests.types.js';

export const CONTEST_SELECT = [
  'id', 'nama', 'jenis', 'level', 'tanggal', 'status', 'hasil', 'piala_url',
  'juara', 'kategori_penghargaan', 'catatan', 'created_by', 'created_at',
  'updated_by', 'updated_at', 'nama_lomba', 'penyelenggara', 'tingkat',
  'deadline', 'status_public', 'website_url', 'deskripsi', 'kota', 'tahun_event', 'planned_work_count', 'academic_year',
].join(',');

export const SUBMISSION_SELECT = [
  'id', 'contest_id', 'film_id', 'judul_film', 'sutradara_id', 'crew_members',
  'link_video', 'award_status', 'sertifikat_url', 'created_by', 'created_at',
].join(',');

export const CONTEST_STORAGE_TABLES = {
  contests: 'contests',
  richSubmissions: 'contest_submissions',
  legacySubmissions: 'contest_films',
  winRate: 'v_contest_win_rate',
} as const;

function optionalText(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function nullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}

function optionalActorId(actorId: string | null): DatabaseRow {
  return actorId ? { created_by: actorId } : {};
}

export function isContestCompatibilitySchemaError(error: unknown): boolean {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(databaseErrorCode(error) || '');
}

export function mapContestPersistenceRow(row: DatabaseRow): ContestRecord {
  const nama = String(row.nama ?? row.nama_lomba ?? '');
  const jenis = String(row.jenis ?? row.penyelenggara ?? '');
  const level = String(row.level ?? '');
  const tanggal = String(row.tanggal ?? row.deadline ?? '');
  const status = String(row.status ?? 'progres');

  return {
    id: String(row.id),
    nama,
    jenis,
    level,
    tanggal,
    status,
    status_public: toPublicContestStatus(status, row.status_public),
    hasil: nullableText(row.hasil),
    nama_lomba: String(row.nama_lomba ?? nama),
    penyelenggara: String(row.penyelenggara ?? jenis),
    kota: nullableText(row.kota),
    tingkat: toPublicContestLevel(row.tingkat ?? level),
    deadline: tanggal,
    tahun_event: row.tahun_event == null ? null : Number(row.tahun_event),
    website_url: nullableText(row.website_url),
    deskripsi: nullableText(row.deskripsi),
    planned_work_count: row.planned_work_count == null ? null : Number(row.planned_work_count),
    academic_year: nullableText(row.academic_year),
    entry_count: row.entry_count == null ? undefined : Number(row.entry_count),
    piala_url: nullableText(row.piala_url),
    juara: nullableText(row.juara),
    kategori_penghargaan: nullableText(row.kategori_penghargaan),
    catatan: nullableText(row.catatan),
    created_by: nullableText(row.created_by),
    created_at: optionalText(row.created_at),
    updated_by: nullableText(row.updated_by),
    updated_at: nullableText(row.updated_at),
  };
}

export function createMemoryContestRecord(input: ContestCreatePersistenceInput): ContestRecord {
  return {
    id: `cnt-${Date.now()}`,
    nama: input.nama,
    jenis: input.jenis,
    level: input.level,
    tanggal: input.tanggal,
    status: input.status,
    status_public: input.statusPublic ?? null,
    hasil: input.hasil,
    nama_lomba: input.namaLomba ?? input.nama,
    penyelenggara: input.penyelenggara ?? input.jenis,
    kota: input.kota ?? null,
    tingkat: input.tingkat ?? undefined,
    deadline: input.deadline ?? input.tanggal,
    tahun_event: input.tahunEvent ?? Number(input.academicYear ?? new Date().getFullYear()),
    website_url: input.websiteUrl ?? null,
    deskripsi: input.deskripsi ?? null,
    planned_work_count: input.plannedWorkCount ?? null,
    academic_year: input.academicYear ?? new Date().getFullYear().toString(),
    created_by: input.actorId,
    created_at: new Date().toISOString(),
  };
}

export function toContestInsertRow(input: ContestCreatePersistenceInput): DatabaseRow {
  return {
    nama: input.nama,
    nama_festival: input.nama,
    jenis: input.jenis,
    level: input.level,
    tanggal: input.tanggal,
    tanggal_lomba: input.tanggal,
    status: input.status,
    hasil: input.hasil,
    nama_lomba: input.namaLomba,
    penyelenggara: input.penyelenggara,
    kota: input.kota,
    tingkat: input.tingkat,
    deadline: input.deadline,
    tahun_event: input.tahunEvent,
    status_public: input.statusPublic,
    website_url: input.websiteUrl,
    deskripsi: input.deskripsi,
    planned_work_count: input.plannedWorkCount,
    academic_year: input.academicYear,
    ...optionalActorId(input.actorId),
  };
}

export function mapRichContestSubmissionRow(row: DatabaseRow): ContestSubmissionRecord {
  return {
    id: String(row.id),
    contest_id: String(row.contest_id),
    film_id: nullableText(row.film_id),
    judul_film: optionalText(row.judul_film),
    sutradara_id: nullableText(row.sutradara_id),
    crew_members: Array.isArray(row.crew_members)
      ? row.crew_members.filter((value): value is string => typeof value === 'string')
      : [],
    link_video: nullableText(row.link_video),
    award_status: nullableText(row.award_status),
    sertifikat_url: nullableText(row.sertifikat_url),
    created_by: nullableText(row.created_by),
    created_at: optionalText(row.created_at),
  };
}

export function mapLegacyContestSubmissionRow(row: DatabaseRow): ContestSubmissionRecord {
  return {
    id: String(row.id),
    contest_id: String(row.contest_id),
    film_id: optionalText(row.film_id) || '',
    created_by: nullableText(row.created_by),
    created_at: optionalText(row.created_at),
  };
}

export function groupContestSubmissions(
  richSubmissionRows: readonly DatabaseRow[],
  legacySubmissionRows: readonly DatabaseRow[],
): Map<string, ContestSubmissionRecord[]> {
  const submissionsByContestId = new Map<string, ContestSubmissionRecord[]>();

  for (const row of richSubmissionRows) {
    const submission = mapRichContestSubmissionRow(row);
    const submissions = submissionsByContestId.get(submission.contest_id) || [];
    submissions.push(submission);
    submissionsByContestId.set(submission.contest_id, submissions);
  }

  for (const row of legacySubmissionRows) {
    const submission = mapLegacyContestSubmissionRow(row);
    const submissions = submissionsByContestId.get(submission.contest_id) || [];
    if (!submissions.some((existingSubmission) => existingSubmission.film_id === submission.film_id)) {
      submissions.push(submission);
    }
    submissionsByContestId.set(submission.contest_id, submissions);
  }

  return submissionsByContestId;
}

export function createMemoryContestSubmissionRecord(
  input: ContestSubmissionPersistenceInput,
): ContestSubmissionRecord {
  return {
    id: `sub-${Date.now()}`,
    contest_id: input.contestId,
    film_id: input.filmId ?? null,
    judul_film: input.judulFilm,
    sutradara_id: input.sutradaraId ?? null,
    crew_members: input.crewMembers || [],
    link_video: input.linkVideo ?? null,
    award_status: input.awardStatus ?? null,
    sertifikat_url: input.sertifikatUrl ?? null,
    created_by: input.actorId,
    created_at: new Date().toISOString(),
  };
}

export function toRichContestSubmissionInsertRow(
  input: ContestSubmissionPersistenceInput,
): DatabaseRow {
  return {
    contest_id: input.contestId,
    film_id: input.filmId ?? null,
    judul_film: input.judulFilm,
    sutradara_id: input.sutradaraId ?? null,
    crew_members: input.crewMembers || [],
    link_video: input.linkVideo ?? null,
    award_status: input.awardStatus ?? null,
    sertifikat_url: input.sertifikatUrl ?? null,
    ...optionalActorId(input.actorId),
  };
}

export function toLegacyContestFilmInsertRow(
  input: ContestSubmissionPersistenceInput,
): DatabaseRow {
  return {
    contest_id: input.contestId,
    film_id: input.filmId,
    ...optionalActorId(input.actorId),
  };
}
