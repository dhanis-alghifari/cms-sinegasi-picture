import type { ActorSummary } from '../../shared/actors/actors.types.js';

export const CONTEST_ENTRY_STATUSES = [
  'proses_submit',
  'sudah_terkirim',
  'menunggu_pengumuman',
  'selesai',
] as const;
export type ContestEntryStatus = typeof CONTEST_ENTRY_STATUSES[number];
export type ContestEntryOutcomeStatus = 'pending' | 'awarded' | 'not_awarded';
export type ContestEvidenceTargetStatus = 'sudah_terkirim' | 'selesai';
export type ContestFinalizeResultKind = 'rank' | 'finalist' | 'nominee' | 'other';

export const CONTEST_WORK_TYPES = [
  'short_film',
  'documentary',
  'photography',
  'animation',
  'commercial',
  'music_video',
  'experimental',
  'other',
] as const;
export type ContestWorkType = typeof CONTEST_WORK_TYPES[number];

export interface ContestWorkTypeRecord {
  code: ContestWorkType;
  label: string;
  sort_order?: number;
}

export interface MediaWorkRecord {
  id: string;
  title: string;
  work_type_code: string;
  work_type_label?: string;
  description?: string | null;
  duration_minutes?: number | null;
  production_year?: number | null;
  primary_asset_url?: string | null;
  video_url?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface ContestEntryRecord {
  id: string;
  contest_id: string;
  work_id: string;
  pipeline_status: ContestEntryStatus;
  result_label?: string | null;
  result_note?: string | null;
  outcome_status?: ContestEntryOutcomeStatus;
  submitted_at?: string | null;
  completed_at?: string | null;
  work?: MediaWorkRecord;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface ContestEntryListQuery {
  page?: string;
  pageSize?: string;
  status?: string;
}

export interface CreateContestEntryInput {
  contest_id?: string;
  work_id?: string;
  work?: {
    title?: string;
    work_type_code?: string;
    description?: string;
    primary_asset_url?: string;
    video_url?: string;
  };
}

export interface TransitionContestEntryInput {
  status?: string;
  evidence_id?: string;
  change_reason?: string;
}

export interface ReserveContestEvidenceInput {
  target_status?: string;
  file_name?: string;
  content_type?: string;
  file_size_bytes?: number;
}

export interface FinalizeContestEntryInput {
  outcome_status?: string;
  results?: Array<{
    result_kind?: string;
    result_title?: string;
    position?: number | null;
  }>;
  evidence_id?: string;
  change_reason?: string;
}

export interface ContestEntryEvidenceRecord {
  id: string;
  entry_id: string;
  evidence_type: 'submission' | 'result' | 'other';
  object_key?: string | null;
  public_url?: string | null;
  storage_provider: 'legacy_url' | 'r2';
  target_status?: ContestEvidenceTargetStatus | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  original_filename?: string | null;
  upload_status: 'pending' | 'attached' | 'abandoned';
  attached_status?: ContestEvidenceTargetStatus | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContestEntryMutationContext {
  idempotencyKey: string;
  requestId?: string;
  operationId?: string;
  userAgent?: string;
}

export interface ContestEvidenceStorage {
  createUpload(fileName: string, folder: string, contentType: string): { uploadUrl: string; key: string; expiresInSeconds: number };
  verifyUpload(objectKey: string, contentType: string, fileSizeBytes: number): Promise<boolean>;
}

export interface ContestEntriesMemoryState {
  works: MediaWorkRecord[];
  entries: ContestEntryRecord[];
  evidence?: ContestEntryEvidenceRecord[];
  statusHistory: Array<{
    entry_id: string;
    from_status: ContestEntryStatus;
    to_status: ContestEntryStatus;
    change_reason: string;
    changed_by: string | null;
    created_at: string;
  }>;
}

export interface ContestEntriesRepository {
  isConfigured(): boolean;
  list(contestId: string, query: ContestEntryListQuery): Promise<{ data: ContestEntryRecord[]; total: number; page: number; pageSize: number; totalPages: number } | { error: unknown }>;
  listWorkTypes(): Promise<{ data: ContestWorkTypeRecord[] } | { error: unknown }>;
  get(entryId: string): Promise<{ data: ContestEntryRecord | null } | { error: unknown }>;
  create(input: {
    contestId: string;
    workId?: string;
    work?: Required<Pick<MediaWorkRecord, 'title' | 'work_type_code'>> & Partial<Pick<MediaWorkRecord, 'description' | 'primary_asset_url' | 'video_url'>>;
    actorId: string;
  }): Promise<{ data: ContestEntryRecord } | { error: unknown }>;
  transition(input: {
    entryId: string;
    status: Extract<ContestEntryStatus, 'sudah_terkirim' | 'menunggu_pengumuman'>;
    evidenceId?: string;
    changeReason: string;
    actorId: string;
    context: ContestEntryMutationContext;
  }): Promise<{ data: ContestEntryRecord } | { error: unknown }>;
  reserveEvidence(input: {
    entryId: string;
    targetStatus: ContestEvidenceTargetStatus;
    objectKey: string;
    mimeType: string;
    fileSizeBytes: number;
    originalFilename: string;
    actorId: string;
  }): Promise<{ data: ContestEntryEvidenceRecord } | { error: unknown }>;
  getEvidence(evidenceId: string): Promise<{ data: ContestEntryEvidenceRecord | null } | { error: unknown }>;
  finalize(input: {
    entryId: string;
    outcomeStatus: Extract<ContestEntryOutcomeStatus, 'awarded' | 'not_awarded'>;
    results: Array<{ result_kind: ContestFinalizeResultKind; result_title: string; position?: number | null }>;
    evidenceId: string;
    changeReason: string;
    actorId: string;
    context: ContestEntryMutationContext;
  }): Promise<{ data: ContestEntryRecord; results: unknown[] } | { error: unknown }>;
}
