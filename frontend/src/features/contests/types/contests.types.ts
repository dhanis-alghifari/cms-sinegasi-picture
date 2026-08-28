// src/features/contests/types/contests.types.ts
// Film Contests & Achievements domain types according to PRD schema
import type { ActorSummary } from '@/shared/types/common';

export type ContestScope = 'bekasi' | 'jabodetabek' | 'jawa_barat' | 'nasional' | 'umum';
/** @deprecated Use ContestScope. Kept as a domain alias for existing imports. */
export type ContestLevel = ContestScope;
export type ContestStatus = 'buka' | 'proses_penjurian' | 'selesai';
export type AwardStatus = 'Juara 1' | 'Juara 2' | 'Juara 3' | 'Harapan' | 'Finalis' | 'Peserta';
export type WorkTypeCode = 'short_film' | 'documentary' | 'photography' | 'animation' | 'commercial' | 'music_video' | 'experimental' | 'other';
export type ContestEntryStatus = 'proses_submit' | 'sudah_terkirim' | 'menunggu_pengumuman' | 'selesai';
export type ContestResultKind = 'rank' | 'top_n' | 'special_award' | 'finalist' | 'nominee' | 'honorable_mention' | 'other';
export type ContestFinalizeResultKind = 'rank' | 'finalist' | 'nominee' | 'other';
export type ContestOutcomeStatus = 'pending' | 'awarded' | 'not_awarded';

export interface FilmSubmission {
  id: string;
  contest_id: string;
  judul_film: string;
  sutradara_id: string;
  sutradara_nama: string;
  crew_members?: string[];
  link_video: string;
  award_status: AwardStatus;
  sertifikat_url?: string;
  created_at: string;
  created_actor?: ActorSummary;
}

export interface Contest {
  id: string;
  nama_lomba: string;
  penyelenggara?: string;
  kota?: string | null;
  tingkat: ContestScope;
  deadline: string;
  status: ContestStatus;
  status_public?: ContestStatus;
  tahun_event?: number | null;
  website_url?: string;
  deskripsi?: string;
  submissions?: FilmSubmission[];
  submission_count?: number;
  entry_count?: number;
  planned_work_count?: number | null;
  academic_year?: string;
  created_at: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface ContestFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  tingkat?: ContestScope;
  status?: ContestStatus;
  tahun_event?: number;
}

export interface ContestSummary {
  totalLomba: number;
  lombaAktif: number;
  totalKaryaSubmitted: number;
  totalPrestasiJuara: number;
}

export interface CreateContestPayload {
  nama_lomba: string;
  kota: string;
  tingkat: ContestScope;
  deadline: string;
  status: ContestStatus;
  tahun_event: number;
  website_url?: string;
  deskripsi?: string;
}

export type UpdateContestPayload = Partial<CreateContestPayload>;

export interface SubmitFilmEntryPayload {
  contest_id: string;
  judul_film: string;
  sutradara_id: string;
  crew_members?: string[];
  link_video: string;
  award_status: AwardStatus;
  sertifikat_url?: string;
}

export interface MediaWork {
  id: string;
  title: string;
  work_type_code: WorkTypeCode | string;
  work_type_label?: string;
  description?: string | null;
  primary_asset_url?: string | null;
  video_url?: string | null;
}

export interface ContestEntry {
  id: string;
  contest_id: string;
  work_id: string;
  pipeline_status: ContestEntryStatus;
  result_label?: string | null;
  result_note?: string | null;
  outcome_status?: ContestOutcomeStatus;
  submitted_at?: string | null;
  completed_at?: string | null;
  work?: MediaWork;
  created_at?: string;
  updated_at?: string;
}

export interface ContestEntryResult {
  result_id: string | null;
  entry_id: string;
  contest_id: string;
  work_id: string;
  pipeline_status: ContestEntryStatus;
  outcome_status: ContestOutcomeStatus;
  work_title: string;
  work_type_code: string;
  nama_lomba: string;
  kota?: string | null;
  tingkat?: string | null;
  tahun_event?: number | null;
  status_public?: ContestStatus | null;
  result_kind: ContestResultKind | null;
  result_title: string;
  position?: number | null;
  category_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface ContestAchievementsResponse {
  data: ContestEntryResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContestAchievementsParams {
  search?: string;
  result_kind?: ContestResultKind;
  position?: number;
  outcome_status?: ContestOutcomeStatus;
  tahun_event?: number;
  page?: number;
  pageSize?: number;
}

export interface RecordContestResultPayload {
  outcome_status: ContestOutcomeStatus;
  results: Array<{
    result_kind: ContestResultKind;
    result_title: string;
    position?: number | null;
    category_name?: string;
    notes?: string;
  }>;
  change_reason: string;
  evidence_url?: string;
}

export interface ContestEntriesResponse {
  data: ContestEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateContestEntryPayload {
  work_id?: string;
  work?: {
    title: string;
    work_type_code: WorkTypeCode;
  };
}

export interface TransitionContestEntryPayload {
  status: Extract<ContestEntryStatus, 'sudah_terkirim' | 'menunggu_pengumuman'>;
  evidence_id?: string;
  change_reason: string;
}

export interface ContestEvidenceUploadReservation {
  evidence_id: string;
  upload_url: string;
  expires_in_seconds: number;
}

export interface FinalizeContestEntryPayload {
  outcome_status: Extract<ContestOutcomeStatus, 'awarded' | 'not_awarded'>;
  results: Array<{
    result_kind: ContestFinalizeResultKind;
    result_title: string;
    position?: number | null;
  }>;
  evidence_id: string;
  change_reason: string;
}

export interface FinalizeContestEntryResponse {
  entry: ContestEntry;
  results: Array<Record<string, unknown>>;
}
