export const CONTEST_RESULT_KINDS = [
  'rank',
  'top_n',
  'special_award',
  'finalist',
  'nominee',
  'honorable_mention',
  'other',
] as const;
export type ContestResultKind = typeof CONTEST_RESULT_KINDS[number];

export const CONTEST_OUTCOME_STATUSES = ['pending', 'awarded', 'not_awarded'] as const;
export type ContestOutcomeStatus = typeof CONTEST_OUTCOME_STATUSES[number];

export interface ContestEntryResultInput {
  result_kind: ContestResultKind;
  result_title: string;
  position?: number | null;
  category_name?: string | null;
  notes?: string | null;
}

export interface ContestAchievementRecord {
  entry_id: string;
  contest_id: string;
  work_id: string;
  pipeline_status: string;
  outcome_status: ContestOutcomeStatus;
  work_title: string;
  work_type_code: string;
  nama_lomba: string;
  kota?: string | null;
  tingkat?: string | null;
  tahun_event?: number | null;
  status_public?: string | null;
  completed_at?: string | null;
  evidence_count: number;
  awards: ContestAchievementAward[];
  /** @deprecated Use awards. Kept for clients during the grouped-list rollout. */
  result_id?: string | null;
  /** @deprecated Use awards. */
  result_kind?: ContestResultKind | null;
  /** @deprecated Use awards. */
  result_title?: string;
  /** @deprecated Use awards. */
  position?: number | null;
  /** @deprecated Use awards. */
  category_name?: string | null;
  /** @deprecated Use awards. */
  notes?: string | null;
  created_at?: string | null;
}

export interface ContestAchievementAward {
  id: string;
  result_kind: ContestResultKind;
  result_title: string;
  position?: number | null;
  category_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface ContestAchievementEvidence {
  id: string;
  evidence_type: 'submission' | 'result' | 'other';
  target_status?: 'sudah_terkirim' | 'selesai' | null;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  created_at?: string | null;
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
  created_at?: string | null;
}

export interface ContestAchievementDetail {
  entry: ContestAchievementDetailEntry;
  awards: ContestAchievementAward[];
  evidence: ContestAchievementEvidence[];
  timeline: ContestAchievementTimelineItem[];
}

export interface ContestAchievementDetailEntry {
  id: string;
  contest_id: string;
  work_id: string;
  pipeline_status: string;
  outcome_status: ContestOutcomeStatus;
  result_label?: string | null;
  result_note?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  work: {
    id: string;
    title: string;
    work_type_code: string;
    description?: string | null;
    duration_minutes?: number | null;
    production_year?: number | null;
    primary_asset_url?: string | null;
    video_url?: string | null;
  };
  contest: {
    id: string;
    nama_lomba: string;
    kota?: string | null;
    tingkat?: string | null;
    tahun_event?: number | null;
    status_public?: string | null;
  };
}

export interface ContestAchievementListQuery {
  search?: string;
  result_kind?: string;
  position?: string;
  outcome_status?: string;
  tahun_event?: string;
  page?: string;
  pageSize?: string;
}

export interface ContestAchievementListResult {
  data: ContestAchievementRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RecordContestResultInput {
  outcome_status: ContestOutcomeStatus;
  results: ContestEntryResultInput[];
  change_reason: string;
  idempotency_key?: string;
  evidence_url?: string;
}

export interface ContestAchievementsMemoryState {
  achievements: ContestAchievementRecord[];
}

export interface ContestAchievementsRepository {
  isConfigured(): boolean;
  list(query: {
    search?: string;
    resultKind?: ContestResultKind;
    position?: number;
    outcomeStatus?: ContestOutcomeStatus;
    tahunEvent?: number;
    page: number;
    pageSize: number;
  }): Promise<ContestAchievementListResult | { error: unknown }>;
  getDetail(entryId: string): Promise<{ data: ContestAchievementDetail | null } | { error: unknown }>;
  record(input: {
    entryId: string;
    outcomeStatus: ContestOutcomeStatus;
    results: ContestEntryResultInput[];
    changeReason: string;
    actorId: string;
    idempotencyKey: string;
    evidenceUrl?: string;
  }): Promise<{ data: unknown } | { error: unknown }>;
}
