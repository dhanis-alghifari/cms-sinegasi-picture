import { z } from 'zod';
import {
  decodeDataEnvelope,
  decodePaginatedResponse,
} from '@/shared/api/responseValidation';
import type {
  SocialAccount,
  SocialEvidence,
  SocialInsightPeriod,
  SocialMetrics,
  SocialPublication,
  SocialReportData,
  SocialSnapshot,
} from '../types/socialMedia.types';

const platformSchema = z.enum(['instagram', 'tiktok', 'youtube', 'whatsapp']);

export const socialAccountSchema: z.ZodType<SocialAccount> = z.object({
  id: z.string().min(1),
  platform: platformSchema,
  account_name: z.string().min(1),
  account_url: z.string().url(),
  is_active: z.boolean(),
  version: z.number().int().positive(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).loose();

export const socialEvidenceSchema: z.ZodType<SocialEvidence> = z.object({
  id: z.string().min(1),
  upload_status: z.enum(['pending', 'attached', 'abandoned']),
  mime_type: z.string().min(1),
  file_size_bytes: z.coerce.number().int().positive(),
  original_filename: z.string().min(1),
  created_at: z.string().min(1),
  access_url: z.string().url().optional(),
  expires_in_seconds: z.number().int().positive().optional(),
}).loose();

export const socialPublicationSchema: z.ZodType<SocialPublication> = z.object({
  id: z.string().min(1),
  social_account_id: z.string().min(1),
  platform: platformSchema,
  content_type: z.enum(['feed', 'reel', 'story', 'video', 'short', 'community_post', 'channel_post']),
  caption: z.string(),
  published_at: z.string().min(1),
  platform_url: z.string().url().nullable(),
  status: z.enum(['draft', 'recorded', 'archived']),
  version: z.number().int().positive(),
  created_by: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  evidence: z.array(socialEvidenceSchema).default([]),
}).loose();

export const socialSnapshotSchema: z.ZodType<SocialSnapshot> = z.object({
  id: z.string().min(1),
  social_account_id: z.string().min(1),
  platform: platformSchema,
  account_name: z.string().optional(),
  as_of_date: z.string().min(1),
  audience_count: z.coerce.number().int().nonnegative(),
  growth_count: z.coerce.number().int().nullable(),
  growth_percent: z.coerce.number().nullable(),
  comparison_snapshot: z.object({
    as_of_date: z.string().min(1),
    audience_count: z.coerce.number().int().nonnegative(),
  }).nullable().optional().default(null),
  created_at: z.string().min(1),
}).loose();

export const socialInsightPeriodSchema: z.ZodType<SocialInsightPeriod> = z.object({
  id: z.string().min(1),
  social_account_id: z.string().min(1),
  platform: platformSchema,
  account_name: z.string().optional(),
  archive_month: z.string().nullable(),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  views: z.coerce.number().int().nonnegative().nullable(),
  reach: z.coerce.number().int().nonnegative().nullable(),
  interactions: z.coerce.number().int().nonnegative().nullable(),
  profile_visits: z.coerce.number().int().nonnegative().nullable(),
  published_count: z.coerce.number().int().nonnegative().nullable(),
  likes: z.coerce.number().int().nonnegative().nullable(),
  comments: z.coerce.number().int().nonnegative().nullable(),
  shares: z.coerce.number().int().nonnegative().nullable(),
  saves: z.coerce.number().int().nonnegative().nullable(),
  watch_time_minutes: z.coerce.number().int().nonnegative().nullable(),
  subscribers_gained: z.coerce.number().int().nonnegative().nullable(),
  subscribers_lost: z.coerce.number().int().nonnegative().nullable(),
  impressions: z.coerce.number().int().nonnegative().nullable(),
  followers_gained: z.coerce.number().int().nonnegative().nullable(),
  followers_lost: z.coerce.number().int().nonnegative().nullable(),
  reactions: z.coerce.number().int().nonnegative().nullable(),
  poll_votes: z.coerce.number().int().nonnegative().nullable(),
  notes: z.string().nullable(),
  status: z.enum(['draft', 'recorded']),
  version: z.number().int().positive(),
  evidence: z.array(socialEvidenceSchema).default([]),
  created_at: z.string().min(1),
}).loose();

const metricsSchema: z.ZodType<SocialMetrics> = z.object({
  snapshots: z.array(socialSnapshotSchema),
  insight_periods: z.array(socialInsightPeriodSchema),
}).loose();

const reportSchema: z.ZodType<SocialReportData> = z.object({
  range: z.object({ from: z.string().min(1), to: z.string().min(1) }),
  trend_range: z.object({ from: z.string().min(1), to: z.string().min(1) }),
  complete: z.boolean(),
  truncated: z.boolean(),
  totals: z.object({
    publications: z.number().int().nonnegative(),
    accounts: z.number().int().nonnegative(),
    insight_periods: z.number().int().nonnegative(),
    evidence_images: z.number().int().nonnegative(),
  }),
  monthly_growth: z.array(z.object({
    id: z.string().min(1),
    platform: platformSchema,
    account_name: z.string().min(1),
    is_active: z.boolean(),
    points: z.array(z.object({
      month: z.string().min(1),
      as_of_date: z.string().nullable(),
      audience_count: z.coerce.number().int().nonnegative().nullable(),
      growth_count: z.coerce.number().int().nullable(),
      growth_percent: z.coerce.number().nullable(),
      comparison_snapshot: z.object({
        as_of_date: z.string().min(1),
        audience_count: z.coerce.number().int().nonnegative(),
      }).nullable(),
    })),
  })),
  publications: z.array(socialPublicationSchema),
  insight_periods: z.array(socialInsightPeriodSchema),
}).loose();

export const decodeSocialAccounts = decodeDataEnvelope(z.array(socialAccountSchema));
export const decodeSocialAccount = decodeDataEnvelope(socialAccountSchema);
export const decodeSocialPublication = decodeDataEnvelope(socialPublicationSchema);
export const decodeSocialPublications = decodePaginatedResponse(socialPublicationSchema);
export const decodeSocialSnapshot = decodeDataEnvelope(socialSnapshotSchema);
export const decodeSocialInsightPeriod = decodeDataEnvelope(socialInsightPeriodSchema);
export const decodeSocialMetrics = decodeDataEnvelope(metricsSchema);
export const decodeSocialReport = decodeDataEnvelope(reportSchema);

export const decodeSocialEvidenceReservation = decodeDataEnvelope(z.object({
  evidence: socialEvidenceSchema,
  upload_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
}).loose());

export const decodeSocialEvidenceCompletion = decodeDataEnvelope(z.object({
  evidence: socialEvidenceSchema,
  access_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
}).loose());

export const decodeSocialEvidenceAccess = decodeDataEnvelope(z.array(z.object({
  id: z.string().min(1),
  access_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
}).loose()));

export const decodeSocialInsightPeriodUpdate = decodeDataEnvelope(socialInsightPeriodSchema);
