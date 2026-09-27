import type { PublicationType, SocialPlatform } from '../types/socialMedia.types';

export const CONTENT_TYPES_BY_PLATFORM: Readonly<Record<SocialPlatform, readonly PublicationType[]>> = {
  instagram: ['feed', 'reel', 'story'],
  tiktok: ['video', 'story'],
  youtube: ['video', 'short', 'community_post'],
  whatsapp: ['channel_post'],
};

export const SOCIAL_PLATFORM_LABELS: Readonly<Record<SocialPlatform, string>> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp Channel',
};

export const SOCIAL_CONTENT_LABELS: Readonly<Record<PublicationType, string>> = {
  feed: 'Feed',
  reel: 'Reel',
  story: 'Story',
  video: 'Video',
  short: 'Shorts',
  community_post: 'Community post',
  channel_post: 'Channel post',
};

const PLATFORM_HOSTS: Readonly<Record<SocialPlatform, readonly string[]>> = {
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  whatsapp: ['whatsapp.com', 'whatsapp.net', 'wa.me'],
};

export function isStoryPublication(platform: SocialPlatform, contentType: PublicationType): boolean {
  return (platform === 'instagram' || platform === 'tiktok') && contentType === 'story';
}

export function isAllowedPlatformUrl(platform: SocialPlatform, value: string): boolean {
  try {
    const url = new URL(value);
    const authority = value.trim().match(/^https:\/\/([^/?#]+)/i)?.[1] ?? '';
    if (url.username || url.password || url.port || /:\d+$/.test(authority)) return false;
    return url.protocol === 'https:'
      && PLATFORM_HOSTS[platform].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function getPublicationValidationError(input: {
  platform: SocialPlatform;
  contentType: PublicationType;
  platformUrl: string;
  evidenceCount: number;
}): string | null {
  if (!CONTENT_TYPES_BY_PLATFORM[input.platform].includes(input.contentType)) {
    return 'Jenis konten tidak sesuai dengan platform akun.';
  }
  if (isStoryPublication(input.platform, input.contentType)) {
    return input.evidenceCount > 0 ? null : 'Story Instagram/TikTok wajib memiliki minimal satu foto bukti.';
  }
  if (input.platform === 'whatsapp') {
    if (input.platformUrl.trim() && isAllowedPlatformUrl('whatsapp', input.platformUrl.trim())) return null;
    return input.evidenceCount > 0 ? null : 'Konten Channel WhatsApp memerlukan tautan WhatsApp atau minimal satu foto bukti.';
  }
  if (!input.platformUrl.trim()) return 'Tautan publikasi wajib diisi.';
  if (!isAllowedPlatformUrl(input.platform, input.platformUrl.trim())) {
    return 'Gunakan tautan HTTPS yang berasal dari platform akun tersebut.';
  }
  return null;
}

export function isSupportedEvidenceFile(file: Pick<File, 'type' | 'size'>): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    && file.size > 0
    && file.size <= 5 * 1024 * 1024;
}
