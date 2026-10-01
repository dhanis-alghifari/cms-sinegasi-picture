import assert from 'node:assert/strict';
import test from 'node:test';
import { SocialMediaService, SocialMediaServiceError, isAllowedSocialUrl } from './social-media.service.js';
import type { SocialAccount, SocialMediaRepository, SocialSnapshot } from './social-media.types.js';

const account: SocialAccount = {
  id: 'account-1', platform: 'instagram', account_name: 'Sinegasi', account_url: 'https://instagram.com/sinegasi',
  is_active: true, version: 1, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
};

function serviceWith(overrides: Partial<SocialMediaRepository> = {}): SocialMediaService {
  return new SocialMediaService({
    isConfigured: () => false,
    listAccounts: async () => ({ data: [account] }),
    ...overrides,
  } as unknown as SocialMediaRepository);
}

test('social media URLs require HTTPS on the platform host and reject credentials/ports', () => {
  assert.equal(isAllowedSocialUrl('instagram', 'https://www.instagram.com/p/abc'), true);
  assert.equal(isAllowedSocialUrl('instagram', 'http://instagram.com/p/abc'), false);
  assert.equal(isAllowedSocialUrl('instagram', 'https://instagram.com.evil.example/p/abc'), false);
  assert.equal(isAllowedSocialUrl('instagram', 'https://user:pass@instagram.com/p/abc'), false);
  assert.equal(isAllowedSocialUrl('instagram', 'https://instagram.com:444/p/abc'), false);
});

test('Instagram story cannot be created as recorded without verified evidence flow', async () => {
  let persisted = false;
  const service = serviceWith({ createPublication: async () => { persisted = true; return { error: null as never }; } });
  await assert.rejects(() => service.createPublication({
    social_account_id: account.id, content_type: 'story', caption: 'Story kegiatan', published_at: '2026-09-27', status: 'recorded',
  }, 'actor-1', 'story-key-0001', 'mencatat konten'), (error: unknown) => error instanceof SocialMediaServiceError && error.errorCode === 'SOCIAL_STORY_EVIDENCE_REQUIRED');
  assert.equal(persisted, false);
});

test('WhatsApp channel post without link needs attached evidence before finalization', async () => {
  const whatsappAccount = { ...account, platform: 'whatsapp' as const, account_url: 'https://whatsapp.com/channel/x' };
  const publication = {
    id: 'publication-1', social_account_id: whatsappAccount.id, platform: 'whatsapp' as const,
    content_type: 'channel_post' as const, caption: 'Informasi kegiatan', published_at: '2026-09-27',
    platform_url: null, status: 'draft' as const, version: 1,
    created_by: 'actor-1', created_at: '2026-09-27T00:00:00.000Z', updated_at: '2026-09-27T00:00:00.000Z', evidence: [],
  };
  const service = serviceWith({
    listAccounts: async () => ({ data: [whatsappAccount] }),
    createPublication: async () => ({ data: publication, idempotentReplay: false }),
    getPublication: async () => ({ data: publication }),
    finalizePublication: async () => ({ data: { ...publication, status: 'recorded', version: 2 } }),
  });
  await service.createPublication({ social_account_id: whatsappAccount.id, content_type: 'channel_post', caption: 'Informasi kegiatan', published_at: '2026-09-27' }, 'actor-1', 'whatsapp-key-001', 'mencatat kanal');
  await assert.rejects(() => service.finalizePublication('publication-1', 1, 'actor-1', 'whatsapp-key-002', 'menyelesaikan pencatatan'),
    (error: unknown) => error instanceof SocialMediaServiceError && error.errorCode === 'SOCIAL_PUBLICATION_EVIDENCE_REQUIRED');
});

test('snapshot growth uses the nearest preceding snapshot as a comparison baseline without returning it', async () => {
  const baseline: SocialSnapshot = {
    id: 'snapshot-old', social_account_id: account.id, platform: 'instagram', as_of_date: '2026-08-31',
    audience_count: 100, growth_count: null, growth_percent: null, created_at: '2026-08-31T00:00:00.000Z',
  };
  const inRange: SocialSnapshot = {
    id: 'snapshot-current', social_account_id: account.id, platform: 'instagram', as_of_date: '2026-09-01',
    audience_count: 125, growth_count: null, growth_percent: null, created_at: '2026-09-01T00:00:00.000Z',
  };
  const service = serviceWith({
    listSnapshots: async () => ({ data: [inRange] }),
    listSnapshotBaselines: async () => ({ data: [baseline] }),
    listInsightPeriods: async () => ({ data: [] }),
  });
  const result = await service.metrics('2026-09-01', '2026-09-01');
  assert.deepEqual(result.snapshots.map((snapshot) => snapshot.id), ['snapshot-current']);
  assert.equal(result.snapshots[0]?.growth_count, 25);
  assert.equal(result.snapshots[0]?.growth_percent, 25);
});

test('monthly Instagram archive derives the full calendar-month window and accepts platform metrics', async () => {
  let savedInput: Record<string, unknown> | undefined;
  const service = serviceWith({
    createInsightPeriod: async (input) => {
      savedInput = input;
      return { data: { id: 'insight-1', ...input, platform: 'instagram', status: 'draft', version: 1, created_at: '2020-03-01T00:00:00.000Z', evidence: [] } as never, idempotentReplay: false };
    },
  });

  await service.createInsightPeriod({
    social_account_id: account.id, archive_month: '2020-02', views: 1_200, saves: 40,
  }, 'actor-1', 'insight-month-0001', 'mencatat arsip bulanan');

  assert.equal(savedInput?.archive_month, '2020-02-01');
  assert.equal(savedInput?.period_start, '2020-02-01');
  assert.equal(savedInput?.period_end, '2020-02-29');
  assert.equal(savedInput?.views, 1_200);
  assert.equal(savedInput?.saves, 40);
});

test('monthly WhatsApp archive stores the platform 30-day window ending on the archive month end', async () => {
  const whatsappAccount = { ...account, platform: 'whatsapp' as const, account_url: 'https://whatsapp.com/channel/x' };
  let savedInput: Record<string, unknown> | undefined;
  const service = serviceWith({
    listAccounts: async () => ({ data: [whatsappAccount] }),
    createInsightPeriod: async (input) => {
      savedInput = input;
      return { data: { id: 'insight-2', ...input, platform: 'whatsapp', status: 'draft', version: 1, created_at: '2020-03-01T00:00:00.000Z', evidence: [] } as never, idempotentReplay: false };
    },
  });

  await service.createInsightPeriod({
    social_account_id: whatsappAccount.id, archive_month: '2020-02', reach: 900, followers_gained: 25,
  }, 'actor-1', 'insight-month-0002', 'mencatat arsip kanal');

  assert.equal(savedInput?.period_start, '2020-01-31');
  assert.equal(savedInput?.period_end, '2020-02-29');
});

test('monthly insight archives reject empty and cross-platform metric payloads before persistence', async () => {
  let persisted = false;
  const tiktokAccount = { ...account, platform: 'tiktok' as const, account_url: 'https://tiktok.com/@sinegasi' };
  const service = serviceWith({
    listAccounts: async () => ({ data: [tiktokAccount] }),
    createInsightPeriod: async () => { persisted = true; return { error: null as never }; },
  });

  await assert.rejects(() => service.createInsightPeriod({
    social_account_id: account.id, archive_month: '2020-02',
  }, 'actor-1', 'insight-month-0003', 'mencatat arsip kosong'),
  (error: unknown) => error instanceof SocialMediaServiceError && error.errorCode === 'SOCIAL_ARCHIVE_METRICS_INVALID');
  await assert.rejects(() => service.createInsightPeriod({
    social_account_id: tiktokAccount.id, archive_month: '2020-02', saves: 5,
  }, 'actor-1', 'insight-month-0004', 'metrik beda platform'),
  (error: unknown) => error instanceof SocialMediaServiceError && error.errorCode === 'SOCIAL_ARCHIVE_METRICS_INVALID');
  assert.equal(persisted, false);
});
