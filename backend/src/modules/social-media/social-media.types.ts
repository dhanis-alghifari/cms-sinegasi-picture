export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'whatsapp';
export type SocialContentType = 'feed' | 'reel' | 'story' | 'video' | 'short' | 'community_post' | 'channel_post';
export type SocialStatus = 'draft' | 'recorded' | 'archived';

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  account_name: string;
  account_url: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SocialEvidence {
  id: string;
  upload_status: 'pending' | 'attached' | 'abandoned';
  mime_type: string;
  file_size_bytes: number;
  original_filename: string;
  created_at: string;
  access_url?: string;
  expires_in_seconds?: number;
  object_key?: string;
  publication_id?: string | null;
  insight_period_id?: string | null;
}

export interface SocialPublication {
  id: string;
  social_account_id: string;
  platform: SocialPlatform;
  content_type: SocialContentType;
  caption: string;
  published_at: string;
  platform_url: string | null;
  agenda_activity_id: string | null;
  status: SocialStatus;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  evidence: SocialEvidence[];
}

export interface SocialSnapshot {
  id: string;
  social_account_id: string;
  platform: SocialPlatform;
  as_of_date: string;
  audience_count: number;
  growth_count: number | null;
  growth_percent: number | null;
  created_at: string;
}

export interface SocialInsightPeriod {
  id: string;
  social_account_id: string;
  platform: SocialPlatform;
  period_start: string;
  period_end: string;
  views: number | null;
  reach: number | null;
  interactions: number | null;
  profile_visits: number | null;
  published_count: number | null;
  notes: string;
  status: SocialStatus;
  version: number;
  created_at: string;
  evidence: SocialEvidence[];
}

export interface SocialMutationContext {
  actorId: string;
  idempotencyKey: string;
  changeReason: string;
  requestId?: string | null;
}

export interface SocialMediaRepository {
  isConfigured(): boolean;
  listAccounts(includeInactive: boolean): Promise<{ data: SocialAccount[] } | { error: unknown }>;
  createAccount(input: Record<string, unknown> & SocialMutationContext): Promise<{ data: SocialAccount; idempotentReplay: boolean } | { error: unknown }>;
  updateAccount(input: Record<string, unknown> & SocialMutationContext & { id: string; expectedVersion: number }): Promise<{ data: SocialAccount } | { error: unknown }>;
  listPublications(input: { from: string; to: string; platform?: SocialPlatform; page: number; pageSize: number }): Promise<{ data: SocialPublication[]; total: number; page: number; pageSize: number; totalPages: number } | { error: unknown }>;
  createPublication(input: Record<string, unknown> & SocialMutationContext): Promise<{ data: SocialPublication; idempotentReplay: boolean } | { error: unknown }>;
  getPublication(id: string): Promise<{ data: SocialPublication | null } | { error: unknown }>;
  getInsightPeriod(id: string): Promise<{ data: SocialInsightPeriod | null } | { error: unknown }>;
  finalizePublication(input: SocialMutationContext & { id: string; expectedVersion: number }): Promise<{ data: SocialPublication } | { error: unknown }>;
  reserveEvidence(input: SocialMutationContext & { parentKind: 'publication' | 'insight_period'; parentId: string; objectKey: string; fileName: string; contentType: string; fileSizeBytes: number; expiresInSeconds: number }): Promise<{ data: SocialEvidence; idempotentReplay: boolean } | { error: unknown }>;
  getEvidence(parentKind: 'publication' | 'insight_period', parentId: string, evidenceId: string): Promise<{ data: SocialEvidence | null } | { error: unknown }>;
  completeEvidence(input: SocialMutationContext & { parentKind: 'publication' | 'insight_period'; parentId: string; evidenceId: string }): Promise<{ data: SocialEvidence } | { error: unknown }>;
  listEvidence(parentKind: 'publication' | 'insight_period', parentIds: string[]): Promise<{ data: SocialEvidence[] } | { error: unknown }>;
  createSnapshot(input: Record<string, unknown> & SocialMutationContext): Promise<{ data: SocialSnapshot; idempotentReplay: boolean } | { error: unknown }>;
  createInsightPeriod(input: Record<string, unknown> & SocialMutationContext): Promise<{ data: SocialInsightPeriod; idempotentReplay: boolean } | { error: unknown }>;
  listSnapshots(from: string, to: string): Promise<{ data: SocialSnapshot[] } | { error: unknown }>;
  listSnapshotBaselines(before: string, socialAccountIds: string[]): Promise<{ data: SocialSnapshot[] } | { error: unknown }>;
  listInsightPeriods(from: string, to: string): Promise<{ data: SocialInsightPeriod[] } | { error: unknown }>;
  finalizeInsightPeriod(input: SocialMutationContext & { id: string; expectedVersion: number }): Promise<{ data: SocialInsightPeriod } | { error: unknown }>;
  reportData(from: string, to: string, maxRows: number): Promise<{ activities: Record<string, unknown>[]; publications: SocialPublication[]; snapshots: SocialSnapshot[]; insight_periods: SocialInsightPeriod[] } | { error: unknown }>;
}

export interface SocialMediaMemoryState {
  accounts: SocialAccount[];
  publications: SocialPublication[];
  snapshots: SocialSnapshot[];
  insightPeriods: SocialInsightPeriod[];
}
