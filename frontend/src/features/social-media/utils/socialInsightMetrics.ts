import type { SocialInsightPeriod, SocialPlatform } from '../types/socialMedia.types';

export type SocialInsightMetricKey = Exclude<keyof SocialInsightPeriod, 'id' | 'social_account_id' | 'platform' | 'account_name' | 'archive_month' | 'period_start' | 'period_end' | 'interactions' | 'published_count' | 'notes' | 'status' | 'version' | 'created_at' | 'evidence'>;
export interface SocialInsightMetricDefinition {
  key: SocialInsightMetricKey;
  label: string;
}

interface SocialInsightDisplayMetricDefinition {
  key: SocialInsightMetricKey | 'interactions' | 'published_count';
  label: string;
}

const PLATFORM_METRICS: Readonly<Record<SocialPlatform, readonly SocialInsightMetricDefinition[]>> = {
  instagram: [
    { key: 'views', label: 'Views' }, { key: 'reach', label: 'Akun dijangkau' },
    { key: 'profile_visits', label: 'Kunjungan profil' }, { key: 'likes', label: 'Suka' },
    { key: 'comments', label: 'Komentar' }, { key: 'shares', label: 'Dibagikan' },
    { key: 'saves', label: 'Disimpan' },
  ],
  tiktok: [
    { key: 'views', label: 'Video views' }, { key: 'profile_visits', label: 'Kunjungan profil' },
    { key: 'likes', label: 'Suka' }, { key: 'comments', label: 'Komentar' },
    { key: 'shares', label: 'Dibagikan' }, { key: 'followers_gained', label: 'Pengikut baru' },
  ],
  youtube: [
    { key: 'views', label: 'Views' }, { key: 'watch_time_minutes', label: 'Waktu tonton (menit)' },
    { key: 'subscribers_gained', label: 'Subscriber bertambah' }, { key: 'subscribers_lost', label: 'Subscriber berkurang' },
    { key: 'impressions', label: 'Impresi' },
  ],
  whatsapp: [
    { key: 'reach', label: 'Akun dijangkau' }, { key: 'followers_gained', label: 'Pengikut baru' },
    { key: 'followers_lost', label: 'Berhenti mengikuti' }, { key: 'reactions', label: 'Reaksi' },
    { key: 'poll_votes', label: 'Suara polling' },
  ],
};

const SOURCE_LABELS: Readonly<Record<SocialPlatform, string>> = {
  instagram: 'Instagram Insights / Meta Business Suite',
  tiktok: 'TikTok Studio / Business Suite',
  youtube: 'YouTube Studio Analytics',
  whatsapp: 'WhatsApp Channel Insights',
};

export function getSocialInsightMetricDefinitions(platform: SocialPlatform): readonly SocialInsightMetricDefinition[] {
  return PLATFORM_METRICS[platform];
}

export function getSocialInsightSourceLabel(platform: SocialPlatform): string {
  return SOURCE_LABELS[platform];
}

export function getSocialInsightMetricEntries(period: SocialInsightPeriod): Array<SocialInsightDisplayMetricDefinition & { value: number }> {
  if (period.archive_month === null) {
    const legacyMetrics: Array<SocialInsightDisplayMetricDefinition & { value: number | null }> = [
      { key: 'views', label: 'Views', value: period.views },
      { key: 'reach', label: 'Jangkauan', value: period.reach },
      { key: 'interactions', label: 'Interaksi', value: period.interactions },
      { key: 'profile_visits', label: 'Kunjungan profil', value: period.profile_visits },
      { key: 'published_count', label: 'Konten tayang', value: period.published_count },
    ];
    return legacyMetrics.flatMap((item) => item.value === null ? [] : [{ ...item, value: item.value }]);
  }
  const metrics: Array<SocialInsightDisplayMetricDefinition & { value: number }> = [];
  for (const definition of PLATFORM_METRICS[period.platform]) {
    const value = period[definition.key];
    if (value !== null) metrics.push({ ...definition, value });
  }
  return metrics;
}

export function formatSocialArchiveMonth(value: string): string {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
}

export function getSocialInsightPeriodLabel(platform: SocialPlatform): string {
  return platform === 'whatsapp'
    ? '30 hari terakhir pada bulan arsip'
    : 'Rentang kalender bulan penuh';
}
