export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'whatsapp';
export type PublicationType = 'feed' | 'reel' | 'story' | 'video' | 'short' | 'community_post' | 'channel_post';
export type PublicationStatus = 'draft' | 'recorded' | 'archived';

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
}

export interface SocialPublication {
  id: string;
  social_account_id: string;
  platform: SocialPlatform;
  content_type: PublicationType;
  caption: string;
  published_at: string;
  platform_url: string | null;
  agenda_activity_id: string | null;
  status: PublicationStatus;
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
  notes: string | null;
  status: 'draft' | 'recorded';
  version: number;
  evidence: SocialEvidence[];
  created_at: string;
}

export interface SocialMetrics {
  snapshots: SocialSnapshot[];
  insight_periods: SocialInsightPeriod[];
}

export interface SocialReportActivity {
  id: string;
  activity_date: string;
  activity_name: string;
  activity_description: string;
  instructor_name?: string | null;
  pic_names?: string[];
  photo_access_url?: string | null;
  evidence?: SocialEvidence[];
}

export interface SocialReportData {
  range: { from: string; to: string };
  complete: boolean;
  truncated: boolean;
  totals: { activities: number; publications: number; snapshots: number; insight_periods: number; evidence_images: number };
  activities: SocialReportActivity[];
  publications: SocialPublication[];
  snapshots: SocialSnapshot[];
  insight_periods: SocialInsightPeriod[];
}

export interface SocialMediaPage<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SocialPublicationFilters {
  from?: string;
  to?: string;
  platform?: SocialPlatform;
  page: number;
  pageSize: number;
}

export interface SocialMediaDateFilters {
  from: string;
  to: string;
}

export interface CreateAccountInput {
  platform: SocialPlatform;
  account_name: string;
  account_url: string;
}

export interface CreatePublicationInput {
  social_account_id: string;
  content_type: PublicationType;
  caption: string;
  published_at: string;
  platform_url?: string;
  agenda_activity_id?: string;
  status?: 'draft' | 'recorded';
}

export interface CreateSnapshotInput {
  social_account_id: string;
  as_of_date: string;
  audience_count: number;
}

export interface CreateInsightPeriodInput {
  social_account_id: string;
  period_start: string;
  period_end: string;
  views?: number;
  reach?: number;
  interactions?: number;
  profile_visits?: number;
  published_count?: number;
  notes?: string;
}
