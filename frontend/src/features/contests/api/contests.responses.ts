import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse } from '@/shared/api/responseValidation';
import type { PaginatedResponse } from '@/shared/types/common';
import {
  CONTEST_ENTRY_STATUS_VALUES,
  CONTEST_FINALIZE_RESULT_KIND_VALUES,
  CONTEST_OUTCOME_STATUS_VALUES,
  CONTEST_RESULT_KIND_VALUES,
  CONTEST_SCOPE_VALUES,
  CONTEST_STATUS_VALUES,
  AWARD_STATUS_VALUES,
  WORK_TYPE_VALUES,
  type Contest,
  type ContestAchievementsResponse,
  type ContestEntry,
  type ContestEntryResult,
  type ContestSummary,
  type ContestEvidenceUploadReservation,
  type FinalizeContestEntryResponse,
  type FilmSubmission,
  type MediaWork,
  type RecordContestResultResponse,
} from '../types/contests.types';

const optionalText = z.string().nullable().optional().transform((value) => value ?? undefined);
const nullableText = z.string().nullable().optional();
const actorSummarySchema = z.object({
  id: z.string().min(1),
  nama: z.string().optional(),
  username: z.string().optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
}).passthrough();

const contestStatusResponseSchema = z.union([
  z.enum(CONTEST_STATUS_VALUES),
  z.literal('progres'),
]).transform((value): Contest['status'] => value === 'progres' ? 'proses_penjurian' : value);

const publicContestStatusSchema = z.enum(CONTEST_STATUS_VALUES).nullable().optional()
  .transform((value): Contest['status_public'] => value ?? undefined);

const mediaWorkResponseSchema: z.ZodType<MediaWork> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  work_type_code: z.string().min(1),
  work_type_label: optionalText,
  description: nullableText,
  primary_asset_url: nullableText,
  video_url: nullableText,
}).passthrough();

const contestResponseSchema: z.ZodType<Contest> = z.object({
  id: z.string().min(1),
  nama_lomba: z.string().min(1),
  penyelenggara: optionalText,
  kota: nullableText,
  tingkat: z.enum(CONTEST_SCOPE_VALUES),
  deadline: z.string().min(10),
  status: contestStatusResponseSchema,
  status_public: publicContestStatusSchema,
  tahun_event: z.number().int().nullable().optional(),
  website_url: optionalText,
  deskripsi: optionalText,
  submission_count: z.number().int().nonnegative().optional(),
  entry_count: z.number().int().nonnegative().optional(),
  planned_work_count: z.number().int().positive().nullable().optional(),
  academic_year: optionalText,
  created_at: z.string().optional().transform((value) => value ?? ''),
  updated_at: optionalText,
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).passthrough().transform((value): Contest => ({
  id: value.id,
  nama_lomba: value.nama_lomba,
  penyelenggara: value.penyelenggara,
  kota: value.kota,
  tingkat: value.tingkat,
  deadline: value.deadline,
  status: value.status,
  status_public: value.status_public,
  tahun_event: value.tahun_event,
  website_url: value.website_url,
  deskripsi: value.deskripsi,
  submission_count: value.submission_count,
  entry_count: value.entry_count,
  planned_work_count: value.planned_work_count,
  academic_year: value.academic_year,
  created_at: value.created_at,
  updated_at: value.updated_at,
  created_actor: value.created_actor,
  updated_actor: value.updated_actor,
}));

const contestSummaryResponseSchema: z.ZodType<ContestSummary> = z.object({
  total: z.number().nonnegative(),
  selesai: z.number().nonnegative(),
  progres: z.number().nonnegative(),
  menang: z.number().nonnegative(),
  winRate: z.number().nonnegative(),
  totalLomba: z.number().nonnegative(),
  lombaAktif: z.number().nonnegative(),
  totalKaryaSubmitted: z.number().nonnegative(),
  totalPrestasiJuara: z.number().nonnegative(),
}).transform((value): ContestSummary => ({
  totalLomba: value.totalLomba,
  lombaAktif: value.lombaAktif,
  totalKaryaSubmitted: value.totalKaryaSubmitted,
  totalPrestasiJuara: value.totalPrestasiJuara,
}));

const workTypeResponseSchema = z.object({
  code: z.enum(WORK_TYPE_VALUES),
  label: z.string().min(1),
  sort_order: z.number().int().optional(),
}).passthrough();

const contestEntryResponseSchema: z.ZodType<ContestEntry> = z.object({
  id: z.string().min(1),
  contest_id: z.string().min(1),
  work_id: z.string().min(1),
  pipeline_status: z.enum(CONTEST_ENTRY_STATUS_VALUES),
  result_label: nullableText,
  result_note: nullableText,
  outcome_status: z.enum(CONTEST_OUTCOME_STATUS_VALUES).optional(),
  submitted_at: nullableText,
  completed_at: nullableText,
  work: mediaWorkResponseSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough();

const evidenceReservationResponseSchema: z.ZodType<ContestEvidenceUploadReservation> = z.object({
  evidence_id: z.string().min(1),
  upload_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
}).passthrough();

const finalizedResultSchema = z.object({
  id: z.string().min(1),
  entry_id: z.string().min(1),
  result_kind: z.enum(CONTEST_RESULT_KIND_VALUES),
  result_title: z.string().min(1),
  position: z.number().int().positive().nullable(),
  category_name: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  voided_at: z.string().nullable(),
  voided_by: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

const finalizeResponseSchema: z.ZodType<FinalizeContestEntryResponse> = z.object({
  entry: contestEntryResponseSchema,
  results: z.array(finalizedResultSchema),
}).passthrough();

const achievementResponseSchema: z.ZodType<ContestEntryResult> = z.object({
  result_id: z.string().nullable(),
  entry_id: z.string().min(1),
  contest_id: z.string().min(1),
  work_id: z.string().min(1),
  pipeline_status: z.enum(CONTEST_ENTRY_STATUS_VALUES),
  outcome_status: z.enum(CONTEST_OUTCOME_STATUS_VALUES),
  work_title: z.string(),
  work_type_code: z.string(),
  nama_lomba: z.string(),
  kota: z.string().nullable().optional(),
  tingkat: z.string().nullable().optional(),
  tahun_event: z.number().int().nullable().optional(),
  status_public: z.enum(CONTEST_STATUS_VALUES).nullable().optional(),
  result_kind: z.enum(CONTEST_RESULT_KIND_VALUES).nullable(),
  result_title: z.string(),
  position: z.number().int().positive().nullable().optional(),
  category_name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
}).passthrough();

const recordResultResponseSchema: z.ZodType<RecordContestResultResponse> = z.object({
  entry: z.object({
    id: z.string().min(1),
    outcome_status: z.enum(CONTEST_OUTCOME_STATUS_VALUES),
  }).passthrough(),
  idempotent_replay: z.boolean(),
}).passthrough();

const filmSubmissionResponseSchema: z.ZodType<FilmSubmission> = z.object({
  id: z.string().min(1),
  contest_id: z.string().min(1),
  judul_film: z.string().min(1),
  sutradara_id: z.string().min(1),
  sutradara_nama: z.string(),
  crew_members: z.array(z.string()),
  link_video: z.string().url(),
  award_status: z.enum(AWARD_STATUS_VALUES),
  sertifikat_url: optionalText,
  created_at: z.string().min(1),
  created_actor: actorSummarySchema.optional(),
}).passthrough();

export const decodeContestListResponse = decodePaginatedResponse(contestResponseSchema);
export const decodeContestSummary = decodeDataEnvelope(contestSummaryResponseSchema);
export const decodeContestWorkTypes = decodeDataEnvelope(z.array(workTypeResponseSchema));
export const decodeContestResponse = decodeDataEnvelope(contestResponseSchema);
export const decodeFilmSubmissionResponse = decodeDataEnvelope(filmSubmissionResponseSchema);
export const decodeContestEntriesResponse = decodePaginatedResponse(contestEntryResponseSchema);
export const decodeContestEntryResponse = decodeDataEnvelope(contestEntryResponseSchema);
export const decodeEvidenceReservationResponse = decodeDataEnvelope(evidenceReservationResponseSchema);
export const decodeFinalizeContestEntryResponse = decodeDataEnvelope(finalizeResponseSchema);
export const decodeContestAchievementsResponse: (payload: unknown) => ContestAchievementsResponse = decodePaginatedResponse(achievementResponseSchema);
export const decodeRecordContestResultResponse = decodeDataEnvelope(recordResultResponseSchema);

// Keep the result-kind schema close to the response contract for future
// mutations that need to validate the same finite set.
export const contestFinalizeResultKindSchema = z.enum(CONTEST_FINALIZE_RESULT_KIND_VALUES);

export type ContestListResponse = PaginatedResponse<Contest>;
