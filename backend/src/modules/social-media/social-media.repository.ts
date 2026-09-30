import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import type {
  SocialAccount, SocialEvidence, SocialInsightPeriod, SocialMediaMemoryState,
  SocialMediaRepository, SocialPlatform, SocialPublication, SocialSnapshot,
} from './social-media.types.js';

type SupabaseLike = SupabaseClient | null;
const PAGE_SIZE = 1_000;
const PUBLICATION_SELECT = 'id,social_account_id,platform,content_type,caption,published_at,platform_url,status,version,created_by,created_at,updated_at,social_accounts(platform)';

function row(value: unknown): DatabaseRow {
  return value && typeof value === 'object' ? value as DatabaseRow : {};
}

function text(value: unknown): string { return value == null ? '' : String(value); }
function nullableText(value: unknown): string | null { return value == null ? null : String(value); }

function mapAccount(value: unknown): SocialAccount {
  const item = row(value);
  return {
    id: text(item.id), platform: text(item.platform) as SocialPlatform,
    account_name: text(item.account_name), account_url: text(item.account_url),
    is_active: item.is_active !== false, version: Number(item.version || 1),
    created_at: text(item.created_at), updated_at: text(item.updated_at),
  };
}

function mapEvidence(value: unknown): SocialEvidence {
  const item = row(value);
  return {
    id: text(item.id), upload_status: text(item.upload_status || 'pending') as SocialEvidence['upload_status'],
    mime_type: text(item.mime_type), file_size_bytes: Number(item.file_size_bytes || 0),
    original_filename: text(item.original_filename), created_at: text(item.created_at),
    publication_id: nullableText(item.publication_id), insight_period_id: nullableText(item.insight_period_id),
    ...(item.object_key == null ? {} : { object_key: String(item.object_key) }),
  };
}

function mapPublication(value: unknown): SocialPublication {
  const item = row(value);
  const account = row(item.social_accounts);
  return {
    id: text(item.id), social_account_id: text(item.social_account_id),
    platform: text(item.platform || account.platform) as SocialPlatform,
    content_type: text(item.content_type) as SocialPublication['content_type'],
    caption: text(item.caption), published_at: text(item.published_at),
    platform_url: nullableText(item.platform_url),
    status: text(item.status) as SocialPublication['status'], version: Number(item.version || 1),
    created_by: nullableText(item.created_by), created_at: text(item.created_at), updated_at: text(item.updated_at),
    evidence: [],
  };
}

function mapSnapshot(value: unknown): SocialSnapshot {
  const item = row(value);
  const account = row(item.social_accounts);
  return {
    id: text(item.id), social_account_id: text(item.social_account_id),
    platform: text(item.platform || account.platform) as SocialPlatform,
    as_of_date: text(item.as_of_date), audience_count: Number(item.audience_count || 0),
    growth_count: null, growth_percent: null, created_at: text(item.created_at),
  };
}

function mapInsight(value: unknown): SocialInsightPeriod {
  const item = row(value);
  const account = row(item.social_accounts);
  const metric = (key: string) => item[key] == null ? null : Number(item[key]);
  return {
    id: text(item.id), social_account_id: text(item.social_account_id),
    platform: text(item.platform || account.platform) as SocialPlatform,
    period_start: text(item.period_start), period_end: text(item.period_end),
    views: metric('views'), reach: metric('reach'), interactions: metric('interactions'),
    profile_visits: metric('profile_visits'), published_count: metric('published_count'),
    notes: text(item.notes), status: text(item.status) as SocialInsightPeriod['status'],
    version: Number(item.version || 1), created_at: text(item.created_at), evidence: [],
  };
}

function samePublicationPayload(existing: DatabaseRow, input: Record<string, unknown>): boolean {
  return existing.social_account_id === input.social_account_id
    && existing.platform === input.platform
    && existing.content_type === input.content_type
    && existing.caption === input.caption
    && existing.published_at === input.published_at
    && (existing.platform_url ?? null) === (input.platform_url || null)
    && existing.status === (input.status || 'draft');
}

function sameSnapshotPayload(existing: DatabaseRow, input: Record<string, unknown>): boolean {
  return existing.social_account_id === input.social_account_id
    && existing.as_of_date === input.as_of_date
    && Number(existing.audience_count) === Number(input.audience_count);
}

function sameInsightPayload(existing: DatabaseRow, input: Record<string, unknown>): boolean {
  return existing.social_account_id === input.social_account_id
    && existing.period_start === input.period_start
    && existing.period_end === input.period_end
    && ['views', 'reach', 'interactions', 'profile_visits', 'published_count'].every((key) => (existing[key] ?? null) === (input[key] ?? null))
    && existing.notes === (input.notes || '');
}

function sameEvidencePayload(existing: DatabaseRow, input: { parentColumn: string; parentId: string; fileName: string; contentType: string; fileSizeBytes: number }): boolean {
  return existing[input.parentColumn] === input.parentId
    && existing.original_filename === input.fileName
    && existing.mime_type === input.contentType
    && Number(existing.file_size_bytes) === input.fileSizeBytes;
}

function mapMutationError(error: unknown): { error: unknown } { return { error }; }

async function collectAll(
  query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  maxRows: number,
): Promise<{ data: unknown[] } | { error: unknown; overflow?: boolean }> {
  const data: unknown[] = [];
  for (let from = 0; from <= maxRows; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, maxRows);
    const result = await query(from, to);
    if (result.error) return { error: result.error };
    const page = result.data || [];
    data.push(...page);
    if (data.length > maxRows) return { error: new Error('SOCIAL_REPORT_ROW_LIMIT'), overflow: true };
    if (page.length < to - from + 1) return { data };
  }
  return { data };
}

function memoryNotConfigured(): { error: Error } { return { error: new Error('SOCIAL_MEDIA_DATABASE_REQUIRED') }; }

export function createSocialMediaRepository(client: SupabaseLike, _state: SocialMediaMemoryState): SocialMediaRepository {
  const requireClient = () => client;
  return {
    isConfigured: () => client !== null,

    async listAccounts(includeInactive) {
      const db = requireClient(); if (!db) return { data: [] };
      let query = db.from('social_accounts').select('*').order('platform').order('account_name');
      if (!includeInactive) query = query.eq('is_active', true);
      const result = await query;
      return result.error ? mapMutationError(result.error) : { data: (result.data || []).map(mapAccount) };
    },

    async createAccount(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const replay = await db.from('social_accounts').select('*').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
      if (replay.error) return mapMutationError(replay.error);
      if (replay.data) {
        if (replay.data.platform !== input.platform || replay.data.account_name !== input.account_name || replay.data.account_url !== input.account_url) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        return { data: mapAccount(replay.data), idempotentReplay: true };
      }
      const existing = await db.from('social_accounts').select('*').eq('platform', input.platform).eq('account_name', input.account_name).maybeSingle();
      if (existing.error) return mapMutationError(existing.error);
      if (existing.data) return { error: new Error('SOCIAL_ACCOUNT_DUPLICATE') };
      const result = await db.from('social_accounts').insert({
        platform: input.platform, account_name: input.account_name, account_url: input.account_url,
        idempotency_key: input.idempotencyKey, created_by: input.actorId, updated_by: input.actorId,
      }).select('*').single();
      if (result.error?.code === '23505') {
        const retry = await db.from('social_accounts').select('*').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
        if (!retry.error && retry.data && retry.data.platform === input.platform && retry.data.account_name === input.account_name && retry.data.account_url === input.account_url) return { data: mapAccount(retry.data), idempotentReplay: true };
      }
      return result.error ? mapMutationError(result.error) : { data: mapAccount(result.data), idempotentReplay: false };
    },

    async updateAccount(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const current = await db.from('social_accounts').select('*').eq('id', input.id).maybeSingle();
      if (current.error) return mapMutationError(current.error);
      if (!current.data) return { error: new Error('SOCIAL_ACCOUNT_NOT_FOUND') };
      if (Number(current.data.version) !== input.expectedVersion) return { error: new Error('SOCIAL_VERSION_CONFLICT') };
      const patch: Record<string, unknown> = { updated_by: input.actorId, updated_at: new Date().toISOString(), version: input.expectedVersion + 1 };
      if (typeof input.account_name === 'string') patch.account_name = input.account_name;
      if (typeof input.account_url === 'string') patch.account_url = input.account_url;
      if (typeof input.is_active === 'boolean') patch.is_active = input.is_active;
      const result = await db.from('social_accounts').update(patch).eq('id', input.id).eq('version', input.expectedVersion).select('*').maybeSingle();
      if (result.error) return mapMutationError(result.error);
      return result.data ? { data: mapAccount(result.data) } : { error: new Error('SOCIAL_VERSION_CONFLICT') };
    },

    async listPublications(input) {
      const db = requireClient(); if (!db) return { data: [], total: 0, page: input.page, pageSize: input.pageSize, totalPages: 1 };
      let query = db.from('social_publications').select(PUBLICATION_SELECT, { count: 'exact' })
        .gte('published_at', input.from).lte('published_at', input.to).neq('status', 'archived');
      if (input.platform) query = query.eq('platform', input.platform);
      const from = (input.page - 1) * input.pageSize;
      const result = await query.order('published_at', { ascending: false }).order('id', { ascending: false }).range(from, from + input.pageSize - 1);
      if (result.error) return mapMutationError(result.error);
      const publications = (result.data || []).map(mapPublication);
      const evidence = await this.listEvidence('publication', publications.map((item) => item.id));
      if ('error' in evidence) return evidence;
      const byParent = groupEvidence(evidence.data, 'publication_id');
      publications.forEach((item) => { item.evidence = byParent.get(item.id) || []; });
      const total = Number(result.count || 0);
      return { data: publications, total, page: input.page, pageSize: input.pageSize, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) };
    },

    async createPublication(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const existing = await db.from('social_publications').select(PUBLICATION_SELECT).eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
      if (existing.error) return mapMutationError(existing.error);
      if (existing.data) {
        if (!samePublicationPayload(existing.data, input)) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        return { data: mapPublication(existing.data), idempotentReplay: true };
      }
      const result = await db.from('social_publications').insert({
        social_account_id: input.social_account_id, platform: input.platform, content_type: input.content_type,
        caption: input.caption, published_at: input.published_at, platform_url: input.platform_url || null,
        status: input.status || 'draft',
        idempotency_key: input.idempotencyKey, created_by: input.actorId, updated_by: input.actorId,
      }).select(PUBLICATION_SELECT).single();
      if (result.error?.code === '23505') {
        const retry = await db.from('social_publications').select(PUBLICATION_SELECT).eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
        if (!retry.error && retry.data && samePublicationPayload(retry.data, input)) return { data: mapPublication(retry.data), idempotentReplay: true };
        if (!retry.error && retry.data) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
      }
      if (result.error) return mapMutationError(result.error);
      return { data: mapPublication(result.data), idempotentReplay: false };
    },

    async getPublication(id) {
      const db = requireClient(); if (!db) return { data: null };
      const result = await db.from('social_publications').select(PUBLICATION_SELECT).eq('id', id).maybeSingle();
      if (result.error) return mapMutationError(result.error);
      if (!result.data) return { data: null };
      const publication = mapPublication(result.data);
      const evidence = await this.listEvidence('publication', [id]);
      if ('error' in evidence) return evidence;
      publication.evidence = evidence.data;
      return { data: publication };
    },

    async getInsightPeriod(id) {
      const db = requireClient(); if (!db) return { data: null };
      const result = await db.from('social_insight_periods').select('*,social_accounts(platform)').eq('id', id).maybeSingle();
      if (result.error) return mapMutationError(result.error);
      if (!result.data) return { data: null };
      const insight = mapInsight(result.data);
      const evidence = await this.listEvidence('insight_period', [id]);
      if ('error' in evidence) return evidence;
      insight.evidence = evidence.data;
      return { data: insight };
    },

    async finalizePublication(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const current = await db.from('social_publications').select(PUBLICATION_SELECT).eq('id', input.id).maybeSingle();
      if (current.error) return mapMutationError(current.error);
      if (!current.data) return { error: new Error('SOCIAL_PUBLICATION_NOT_FOUND') };
      if (Number(current.data.version) !== input.expectedVersion) return { error: new Error('SOCIAL_VERSION_CONFLICT') };
      if (current.data.status === 'recorded') return { data: mapPublication(current.data) };
      if (current.data.status !== 'draft') return { error: new Error('SOCIAL_PUBLICATION_NOT_DRAFT') };
      const result = await db.from('social_publications').update({ status: 'recorded', updated_by: input.actorId, updated_at: new Date().toISOString(), version: input.expectedVersion + 1 })
        .eq('id', input.id).eq('version', input.expectedVersion).select(PUBLICATION_SELECT).maybeSingle();
      if (result.error) return mapMutationError(result.error);
      return result.data ? { data: mapPublication(result.data) } : { error: new Error('SOCIAL_VERSION_CONFLICT') };
    },

    async reserveEvidence(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const parentColumn = input.parentKind === 'publication' ? 'publication_id' : 'insight_period_id';
      const table = 'social_media_evidence';
      const now = new Date();
      const nowIso = now.toISOString();
      const expired = await db.from(table).update({ upload_status: 'abandoned', updated_at: new Date().toISOString() })
        .eq(parentColumn, input.parentId).eq('upload_status', 'pending').lt('expires_at', nowIso);
      if (expired.error) return mapMutationError(expired.error);
      const existing = await db.from(table).select('*').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
      if (existing.error) return mapMutationError(existing.error);
      if (existing.data) {
        if (!sameEvidencePayload(existing.data, { parentColumn, parentId: input.parentId, fileName: input.fileName, contentType: input.contentType, fileSizeBytes: input.fileSizeBytes })) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        if (existing.data.upload_status === 'attached') return { error: new Error('SOCIAL_EVIDENCE_ALREADY_COMPLETED') };
        const anotherActive = await db.from(table).select('id').eq(parentColumn, input.parentId).in('upload_status', ['pending', 'attached']).neq('id', existing.data.id).limit(1);
        if (anotherActive.error) return mapMutationError(anotherActive.error);
        if ((anotherActive.data || []).length > 0) return { error: new Error('SOCIAL_EVIDENCE_UPLOAD_IN_PROGRESS') };
        const renewed = await db.from(table).update({ upload_status: 'pending', expires_at: new Date(now.getTime() + input.expiresInSeconds * 1_000).toISOString(), updated_at: nowIso })
          .eq('id', existing.data.id).select('*').single();
        return renewed.error ? mapMutationError(renewed.error) : { data: mapEvidence(renewed.data), idempotentReplay: true };
      }
      const pending = await db.from(table).select('id').eq(parentColumn, input.parentId).eq('upload_status', 'pending').limit(1);
      if (pending.error) return mapMutationError(pending.error);
      if ((pending.data || []).length > 0) return { error: new Error('SOCIAL_EVIDENCE_UPLOAD_IN_PROGRESS') };
      const result = await db.from(table).insert({
        [parentColumn]: input.parentId, object_key: input.objectKey, mime_type: input.contentType,
        file_size_bytes: input.fileSizeBytes, original_filename: input.fileName, idempotency_key: input.idempotencyKey,
        created_by: input.actorId, expires_at: new Date(now.getTime() + input.expiresInSeconds * 1_000).toISOString(),
      }).select('*').single();
      if (result.error?.code === '23505') {
        const retry = await db.from(table).select('*').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
        if (!retry.error && retry.data && sameEvidencePayload(retry.data, { parentColumn, parentId: input.parentId, fileName: input.fileName, contentType: input.contentType, fileSizeBytes: input.fileSizeBytes }) && retry.data.upload_status === 'pending') {
          const renewed = await db.from(table).update({ expires_at: new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString(), updated_at: new Date().toISOString() }).eq('id', retry.data.id).select('*').single();
          return renewed.error ? mapMutationError(renewed.error) : { data: mapEvidence(renewed.data), idempotentReplay: true };
        }
        if (!retry.error && retry.data) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        return { error: new Error('SOCIAL_EVIDENCE_UPLOAD_IN_PROGRESS') };
      }
      return result.error ? mapMutationError(result.error) : { data: mapEvidence(result.data), idempotentReplay: false };
    },

    async getEvidence(parentKind, parentId, evidenceId) {
      const db = requireClient(); if (!db) return { data: null };
      const parentColumn = parentKind === 'publication' ? 'publication_id' : 'insight_period_id';
      const result = await db.from('social_media_evidence').select('*').eq(parentColumn, parentId).eq('id', evidenceId).neq('upload_status', 'abandoned').maybeSingle();
      return result.error ? mapMutationError(result.error) : { data: result.data ? mapEvidence(result.data) : null };
    },

    async completeEvidence(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const parentColumn = input.parentKind === 'publication' ? 'publication_id' : 'insight_period_id';
      const current = await db.from('social_media_evidence').select('*').eq(parentColumn, input.parentId).eq('id', input.evidenceId).maybeSingle();
      if (current.error) return mapMutationError(current.error);
      if (!current.data) return { error: new Error('SOCIAL_EVIDENCE_NOT_FOUND') };
      if (current.data.upload_status === 'attached') return { data: mapEvidence(current.data) };
      if (current.data.upload_status !== 'pending' || (current.data.expires_at && Date.parse(String(current.data.expires_at)) < Date.now())) return { error: new Error('SOCIAL_EVIDENCE_EXPIRED') };
      const result = await db.from('social_media_evidence').update({ upload_status: 'attached', updated_at: new Date().toISOString(), expires_at: null })
        .eq('id', input.evidenceId).eq(parentColumn, input.parentId).eq('upload_status', 'pending').select('*').maybeSingle();
      return result.error ? mapMutationError(result.error) : result.data ? { data: mapEvidence(result.data) } : { error: new Error('SOCIAL_EVIDENCE_EXPIRED') };
    },

    async listEvidence(parentKind, parentIds) {
      const db = requireClient(); if (!db || parentIds.length === 0) return { data: [] };
      const parentColumn = parentKind === 'publication' ? 'publication_id' : 'insight_period_id';
      const rows: unknown[] = [];
      for (let offset = 0; offset < parentIds.length; offset += 100) {
        const chunk = parentIds.slice(offset, offset + 100);
        const result = await collectAll((start, end) => db.from('social_media_evidence').select('*')
          .in(parentColumn, chunk).eq('upload_status', 'attached').order('created_at').order('id').range(start, end), 5_000);
        if ('error' in result) return result;
        rows.push(...result.data);
        if (rows.length > 5_000) return { error: new Error('SOCIAL_REPORT_ROW_LIMIT'), overflow: true };
      }
      return { data: rows.map(mapEvidence) };
    },

    async createSnapshot(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const existing = await db.from('social_account_snapshots').select('*,social_accounts(platform)').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
      if (existing.error) return mapMutationError(existing.error);
      if (existing.data) {
        if (!sameSnapshotPayload(existing.data, input)) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        return { data: mapSnapshot(existing.data), idempotentReplay: true };
      }
      const result = await db.from('social_account_snapshots').insert({
        social_account_id: input.social_account_id, as_of_date: input.as_of_date,
        audience_count: input.audience_count, idempotency_key: input.idempotencyKey, created_by: input.actorId,
      }).select('*,social_accounts(platform)').single();
      if (result.error?.code === '23505') {
        const retry = await db.from('social_account_snapshots').select('*,social_accounts(platform)').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
        if (!retry.error && retry.data && sameSnapshotPayload(retry.data, input)) return { data: mapSnapshot(retry.data), idempotentReplay: true };
        if (!retry.error && retry.data) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        return { error: new Error('SOCIAL_SNAPSHOT_DATE_EXISTS') };
      }
      return result.error ? mapMutationError(result.error) : { data: mapSnapshot(result.data), idempotentReplay: false };
    },

    async createInsightPeriod(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const existing = await db.from('social_insight_periods').select('*,social_accounts(platform)').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
      if (existing.error) return mapMutationError(existing.error);
      if (existing.data) {
        if (!sameInsightPayload(existing.data, input)) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        return { data: mapInsight(existing.data), idempotentReplay: true };
      }
      const result = await db.from('social_insight_periods').insert({
        social_account_id: input.social_account_id, period_start: input.period_start, period_end: input.period_end,
        views: input.views ?? null, reach: input.reach ?? null, interactions: input.interactions ?? null,
        profile_visits: input.profile_visits ?? null, published_count: input.published_count ?? null,
        notes: input.notes || '', status: 'draft', idempotency_key: input.idempotencyKey,
        created_by: input.actorId, updated_by: input.actorId,
      }).select('*,social_accounts(platform)').single();
      if (result.error?.code === '23505') {
        const retry = await db.from('social_insight_periods').select('*,social_accounts(platform)').eq('created_by', input.actorId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
        if (!retry.error && retry.data && sameInsightPayload(retry.data, input)) return { data: mapInsight(retry.data), idempotentReplay: true };
        if (!retry.error && retry.data) return { error: new Error('SOCIAL_IDEMPOTENCY_REUSED') };
        return { error: new Error('SOCIAL_INSIGHT_PERIOD_EXISTS') };
      }
      return result.error ? mapMutationError(result.error) : { data: mapInsight(result.data), idempotentReplay: false };
    },

    async listSnapshots(from, to) {
      const db = requireClient(); if (!db) return { data: [] };
      const result = await collectAll((start, end) => db.from('social_account_snapshots').select('*,social_accounts(platform)').gte('as_of_date', from).lte('as_of_date', to).order('as_of_date').order('id').range(start, end), 5_000);
      return 'error' in result ? result : { data: result.data.map(mapSnapshot) };
    },

    async listSnapshotBaselines(before, socialAccountIds) {
      const db = requireClient(); if (!db || socialAccountIds.length === 0) return { data: [] };
      const baselines: SocialSnapshot[] = [];
      for (let offset = 0; offset < socialAccountIds.length; offset += 100) {
        const chunk = socialAccountIds.slice(offset, offset + 100);
        const results = await Promise.all(chunk.map((accountId) => db.from('social_account_snapshots').select('*,social_accounts(platform)')
          .eq('social_account_id', accountId).lt('as_of_date', before).order('as_of_date', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()));
        const error = results.find((result) => result.error)?.error;
        if (error) return mapMutationError(error);
        baselines.push(...results.flatMap((result) => result.data ? [mapSnapshot(result.data)] : []));
      }
      return { data: baselines };
    },

    async listInsightPeriods(from, to) {
      const db = requireClient(); if (!db) return { data: [] };
      const result = await collectAll((start, end) => db.from('social_insight_periods').select('*,social_accounts(platform)').lte('period_start', to).gte('period_end', from).neq('status', 'archived').order('period_start', { ascending: false }).range(start, end), 5_000);
      if ('error' in result) return result;
      const periods = result.data.map(mapInsight);
      const evidence = await this.listEvidence('insight_period', periods.map((item) => item.id));
      if ('error' in evidence) return evidence;
      const byParent = groupEvidence(evidence.data, 'insight_period_id');
      periods.forEach((item) => { item.evidence = byParent.get(item.id) || []; });
      return { data: periods };
    },

    async finalizeInsightPeriod(input) {
      const db = requireClient(); if (!db) return memoryNotConfigured();
      const current = await db.from('social_insight_periods').select('*,social_accounts(platform)').eq('id', input.id).maybeSingle();
      if (current.error) return mapMutationError(current.error);
      if (!current.data) return { error: new Error('SOCIAL_INSIGHT_PERIOD_NOT_FOUND') };
      if (Number(current.data.version) !== input.expectedVersion) return { error: new Error('SOCIAL_VERSION_CONFLICT') };
      if (current.data.status === 'recorded') return { data: mapInsight(current.data) };
      if (current.data.status !== 'draft') return { error: new Error('SOCIAL_INSIGHT_PERIOD_NOT_DRAFT') };
      const result = await db.from('social_insight_periods').update({ status: 'recorded', updated_by: input.actorId, updated_at: new Date().toISOString(), version: input.expectedVersion + 1 })
        .eq('id', input.id).eq('version', input.expectedVersion).select('*,social_accounts(platform)').maybeSingle();
      return result.error ? mapMutationError(result.error) : result.data ? { data: mapInsight(result.data) } : { error: new Error('SOCIAL_VERSION_CONFLICT') };
    },

    async reportData(from, to, maxRows) {
      const db = requireClient(); if (!db) return { activities: [], publications: [], snapshots: [], insight_periods: [] };
      const [activitiesResult, publicationsResult, snapshotsResult, insightResult] = await Promise.all([
        collectAll((start, end) => db.from('agenda_activities').select('id,activity_date,activity_name,activity_description,instructor_name,pic_names,agenda_activity_photos(id,object_key,upload_status,mime_type,file_size_bytes,original_filename,created_at)')
          .is('archived_at', null).gte('activity_date', from).lte('activity_date', to).order('activity_date', { ascending: false }).order('id', { ascending: false }).range(start, end), maxRows),
        collectAll((start, end) => db.from('social_publications').select(PUBLICATION_SELECT)
          .eq('status', 'recorded').gte('published_at', from).lte('published_at', to).order('published_at', { ascending: false }).order('id', { ascending: false }).range(start, end), maxRows),
        collectAll((start, end) => db.from('social_account_snapshots').select('*,social_accounts(platform)')
          .gte('as_of_date', from).lte('as_of_date', to).order('as_of_date', { ascending: false }).order('id', { ascending: false }).range(start, end), maxRows),
        collectAll((start, end) => db.from('social_insight_periods').select('*,social_accounts(platform)')
          .eq('status', 'recorded').lte('period_start', to).gte('period_end', from).order('period_start', { ascending: false }).order('id', { ascending: false }).range(start, end), maxRows),
      ]);
      if ('error' in activitiesResult) return activitiesResult;
      if ('error' in publicationsResult) return publicationsResult;
      if ('error' in snapshotsResult) return snapshotsResult;
      if ('error' in insightResult) return insightResult;
      const activityRows = activitiesResult.data.map((item) => {
        const activity = row(item);
        const photos = (Array.isArray(activity.agenda_activity_photos) ? activity.agenda_activity_photos : [])
          .map(row).filter((photo) => photo.upload_status === 'attached');
        return {
          id: text(activity.id), activity_date: text(activity.activity_date), activity_name: text(activity.activity_name),
          activity_description: text(activity.activity_description), instructor_name: nullableText(activity.instructor_name),
          pic_names: Array.isArray(activity.pic_names) ? activity.pic_names.map(String) : [],
          _photos: photos.map((photo) => ({
            id: text(photo.id), upload_status: 'attached', mime_type: text(photo.mime_type),
            file_size_bytes: Number(photo.file_size_bytes || 0), original_filename: text(photo.original_filename),
            created_at: text(photo.created_at), object_key: nullableText(photo.object_key),
          })),
        };
      });
      return {
        activities: activityRows,
        publications: publicationsResult.data.map(mapPublication),
        snapshots: snapshotsResult.data.map(mapSnapshot),
        insight_periods: insightResult.data.map(mapInsight),
      };
    },
  };
}

function groupEvidence(items: SocialEvidence[], column: 'publication_id' | 'insight_period_id'): Map<string, SocialEvidence[]> {
  const grouped = new Map<string, SocialEvidence[]>();
  for (const item of items) {
    const parentId = item[column];
    if (typeof parentId !== 'string') continue;
    const list = grouped.get(parentId) || [];
    list.push(item);
    grouped.set(parentId, list);
  }
  return grouped;
}
