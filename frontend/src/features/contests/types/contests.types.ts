import type { ActorSummary } from '@/shared/types/common';

export const CONTEST_SCOPE_VALUES = ['bekasi', 'jabodetabek', 'jawa_barat', 'nasional', 'umum'] as const;
export type ContestScope = typeof CONTEST_SCOPE_VALUES[number];
/** @deprecated Use ContestScope. Kept as a domain alias for existing imports. */
export type ContestLevel = ContestScope;
export const CONTEST_STATUS_VALUES = ['buka', 'proses_penjurian', 'selesai'] as const;
export type ContestStatus = typeof CONTEST_STATUS_VALUES[number];
export const AWARD_STATUS_VALUES = ['Juara 1', 'Juara 2', 'Juara 3', 'Harapan', 'Finalis', 'Peserta'] as const;
export type AwardStatus = typeof AWARD_STATUS_VALUES[number];
export const WORK_TYPE_VALUES = ['short_film', 'documentary', 'photography', 'animation', 'commercial', 'music_video', 'experimental', 'other'] as const;
export type WorkTypeCode = typeof WORK_TYPE_VALUES[number];
export interface ContestWorkTypeOption {
  code: WorkTypeCode;
  label: string;
  sort_order?: number;
}
export const CONTEST_ENTRY_STATUS_VALUES = ['proses_submit', 'sudah_terkirim', 'menunggu_pengumuman', 'selesai'] as const;
export type ContestEntryStatus = typeof CONTEST_ENTRY_STATUS_VALUES[number];
export const CONTEST_RESULT_KIND_VALUES = ['rank', 'top_n', 'special_award', 'finalist', 'nominee', 'honorable_mention', 'other'] as const;
export type ContestResultKind = typeof CONTEST_RESULT_KIND_VALUES[number];
export const CONTEST_FINALIZE_RESULT_KIND_VALUES = ['rank', 'finalist', 'nominee', 'other'] as const;
export type ContestFinalizeResultKind = typeof CONTEST_FINALIZE_RESULT_KIND_VALUES[number];
export const CONTEST_OUTCOME_STATUS_VALUES = ['pending', 'awarded', 'not_awarded'] as const;
export type ContestOutcomeStatus = typeof CONTEST_OUTCOME_STATUS_VALUES[number];
export const CONTEST_FINAL_OUTCOME_STATUS_VALUES = ['awarded', 'not_awarded'] as const;
export type ContestFinalOutcomeStatus = typeof CONTEST_FINAL_OUTCOME_STATUS_VALUES[number];
export const DEFAULT_CONTEST_WORK_TYPE: WorkTypeCode = 'short_film';

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
  created_at?: string | null;
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

export interface ContestAchievementAward {
  id: string;
  entry_id?: string;
  result_kind: ContestResultKind;
  result_title: string;
  position?: number | null;
  category_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface ContestAchievementEvidence {
  id: string;
  entry_id?: string;
  evidence_type: 'submission' | 'result' | 'other';
  target_status?: Extract<ContestEntryStatus, 'sudah_terkirim' | 'selesai'> | null;
  storage_provider?: 'legacy_url' | 'r2' | string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  original_filename?: string | null;
  upload_status?: 'pending' | 'attached' | 'abandoned' | string;
  attached_status?: Extract<ContestEntryStatus, 'sudah_terkirim' | 'selesai'> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ContestAchievementTimelineItem {
  id: string;
  kind: 'status' | 'result';
  status?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  change_reason: string;
  changed_by?: string | null;
  changed_by_name?: string | null;
  created_at: string;
}

export interface ContestAchievementRecord {
  entry_id: string;
  contest_id: string;
  work_id: string;
  pipeline_status: 'selesai';
  outcome_status: Extract<ContestOutcomeStatus, 'awarded' | 'not_awarded'>;
  work_title: string;
  work_type_code: string;
  nama_lomba: string;
  kota?: string | null;
  tingkat?: string | null;
  tahun_event?: number | null;
  status_public?: ContestStatus | null;
  completed_at?: string | null;
  awards: ContestAchievementAward[];
  evidence_count?: number;
}

/** @deprecated Use ContestAchievementRecord. */
export type ContestEntryResult = ContestAchievementRecord;

export interface ContestAchievementsResponse {
  data: ContestAchievementRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContestAchievementDetail {
  entry: {
    id: string;
    contest_id: string;
    work_id: string;
    pipeline_status: ContestEntryStatus;
    outcome_status: ContestOutcomeStatus;
    result_label?: string | null;
    result_note?: string | null;
    submitted_at?: string | null;
    completed_at?: string | null;
    work: MediaWork;
    contest: Pick<Contest, 'id' | 'nama_lomba' | 'kota' | 'tingkat' | 'tahun_event' | 'status_public'>;
  };
  awards: ContestAchievementAward[];
  evidence: ContestAchievementEvidence[];
  timeline: ContestAchievementTimelineItem[];
}

export interface ContestEvidenceAccessResponse {
  access_url: string;
  expires_in_seconds: number | null;
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

export interface RecordContestResultResponse {
  entry: Pick<ContestEntry, 'id' | 'outcome_status'> & Partial<ContestEntry>;
  idempotent_replay: boolean;
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
  outcome_status: ContestFinalOutcomeStatus;
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
  results: FinalizedContestEntryResult[];
}

export interface FinalizedContestEntryResult {
  id: string;
  entry_id: string;
  result_kind: ContestResultKind;
  result_title: string;
  position: number | null;
  category_name: string | null;
  notes: string | null;
  is_active: boolean;
  voided_at: string | null;
  voided_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
