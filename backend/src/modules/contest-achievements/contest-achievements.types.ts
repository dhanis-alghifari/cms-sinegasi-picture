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
  result_id: string | null;
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
  result_kind: ContestResultKind | null;
  result_title: string;
  position?: number | null;
  category_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
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
