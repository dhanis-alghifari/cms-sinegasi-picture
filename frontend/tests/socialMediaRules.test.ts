import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicationValidationError, isAllowedPlatformUrl, isStoryPublication } from '../src/features/social-media/utils/publicationRules';
import { getJakartaToday, getSocialDateRangeError } from '../src/features/social-media/utils/socialMediaDates';

test('Stories on Instagram and TikTok require photo evidence', () => {
  assert.equal(isStoryPublication('instagram', 'story'), true);
  assert.equal(isStoryPublication('tiktok', 'story'), true);
  assert.equal(getPublicationValidationError({ platform: 'instagram', contentType: 'story', platformUrl: '', evidenceCount: 0 }), 'Story Instagram/TikTok wajib memiliki minimal satu foto bukti.');
  assert.equal(getPublicationValidationError({ platform: 'tiktok', contentType: 'story', platformUrl: '', evidenceCount: 1 }), null);
});

test('regular platform publications require HTTPS links on the matching platform', () => {
  assert.equal(isAllowedPlatformUrl('instagram', 'https://www.instagram.com/p/example'), true);
  assert.equal(isAllowedPlatformUrl('youtube', 'https://youtu.be/example'), true);
  assert.equal(isAllowedPlatformUrl('tiktok', 'https://vt.tiktok.com/example'), true);
  assert.equal(isAllowedPlatformUrl('tiktok', 'http://tiktok.com/@user/video/1'), false);
  assert.equal(isAllowedPlatformUrl('instagram', 'https://user:pass@instagram.com/p/example'), false);
  assert.equal(isAllowedPlatformUrl('instagram', 'https://instagram.com:443/p/example'), false);
  assert.equal(isAllowedPlatformUrl('instagram', 'https://example.com/post'), false);
  assert.equal(getPublicationValidationError({ platform: 'youtube', contentType: 'short', platformUrl: '', evidenceCount: 0 }), 'Tautan publikasi wajib diisi.');
});

test('WhatsApp Channel accepts either an approved WhatsApp URL or private evidence', () => {
  assert.equal(getPublicationValidationError({ platform: 'whatsapp', contentType: 'channel_post', platformUrl: '', evidenceCount: 0 }), 'Konten Channel WhatsApp memerlukan tautan WhatsApp atau minimal satu foto bukti.');
  assert.equal(getPublicationValidationError({ platform: 'whatsapp', contentType: 'channel_post', platformUrl: 'https://whatsapp.com/channel/1', evidenceCount: 0 }), null);
  assert.equal(getPublicationValidationError({ platform: 'whatsapp', contentType: 'channel_post', platformUrl: '', evidenceCount: 1 }), null);
});

test('social report range allows at most 366 inclusive days and never future dates', () => {
  const future = new Date(`${getJakartaToday()}T00:00:00Z`);
  future.setUTCDate(future.getUTCDate() + 1);
  const futureDate = future.toISOString().slice(0, 10);
  assert.equal(getSocialDateRangeError({ from: '2025-01-01', to: '2026-01-01' }), null);
  assert.match(getSocialDateRangeError({ from: '2024-12-31', to: '2026-01-01' }) ?? '', /maksimal 366 hari/);
  assert.match(getSocialDateRangeError({ from: futureDate, to: futureDate }) ?? '', /masa depan/);
  assert.match(getSocialDateRangeError({ from: '2026-02-01', to: '2026-01-01' }) ?? '', /tidak boleh melewati/);
});
