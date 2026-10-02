import { generateR2PrivateAccessUrl, generateR2PrivateUploadUrl, generateR2PrivateUploadUrlForKey, inspectCloudflareR2Object, verifyCloudflareR2ImageObject } from '../../services/cloudflareR2Service.js';
import { databaseErrorCode, databaseErrorMessage } from '../../shared/database/database.types.js';
import type {
  CreateSocialInsightInput, SocialAccount, SocialEvidence, SocialInsightPeriod, SocialMediaRepository, SocialMonthlyAudiencePoint,
  SocialMonthlyAudienceSeries, SocialMutationContext, SocialPlatform, SocialPublication, SocialSnapshot,
} from './social-media.types.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_REPORT_RANGE_DAYS = 366;
const MAX_REPORT_ROWS_PER_SECTION = 5_000;
const MAX_PAGE_SIZE = 100;
const CONTENT_TYPES: Readonly<Record<SocialPlatform, readonly string[]>> = {
  instagram: ['feed', 'reel', 'story'],
  tiktok: ['video', 'story'],
  youtube: ['video', 'short', 'community_post'],
  whatsapp: ['channel_post'],
};
const INSIGHT_METRICS: Readonly<Record<SocialPlatform, readonly (keyof CreateSocialInsightInput)[]>> = {
  instagram: ['views', 'reach', 'profile_visits', 'likes', 'comments', 'shares', 'saves'],
  tiktok: ['views', 'profile_visits', 'likes', 'comments', 'shares', 'followers_gained'],
  youtube: ['views', 'watch_time_minutes', 'subscribers_gained', 'subscribers_lost', 'impressions'],
  whatsapp: ['reach', 'followers_gained', 'followers_lost', 'reactions', 'poll_votes'],
};
const ALL_INSIGHT_METRICS = [...new Set(Object.values(INSIGHT_METRICS).flat())]
  .filter((key): key is Exclude<keyof CreateSocialInsightInput, 'social_account_id' | 'archive_month' | 'notes'> => key !== 'social_account_id' && key !== 'archive_month' && key !== 'notes');
const ALLOWED_HOSTS: Readonly<Record<SocialPlatform, readonly string[]>> = {
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  whatsapp: ['whatsapp.com', 'whatsapp.net', 'wa.me'],
};

export class SocialMediaServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string, public readonly details?: unknown) {
    super(message); this.name = 'SocialMediaServiceError';
  }
}

function requiredText(value: unknown, field: string, maxLength: number, minLength = 1): string {
  if (typeof value !== 'string') throw new SocialMediaServiceError(422, 'SOCIAL_INPUT_INVALID', `${field} wajib diisi.`);
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length < minLength || cleaned.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(cleaned)) {
    throw new SocialMediaServiceError(422, 'SOCIAL_INPUT_INVALID', `${field} belum valid.`);
  }
  return cleaned;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function jakartaToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

function dateRangeDays(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, monthNumber! - 1 + offset, 1)).toISOString().slice(0, 7);
}

function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year!, monthNumber!, 0)).toISOString().slice(0, 10);
  return { from, to };
}

function monthlyAudienceSeries(
  accounts: Array<Pick<SocialAccount, 'id' | 'platform' | 'account_name' | 'is_active'>>,
  snapshots: SocialSnapshot[],
  firstDisplayMonth: string,
): SocialMonthlyAudienceSeries[] {
  const snapshotsByAccount = new Map<string, Map<string, SocialSnapshot>>();
  for (const snapshot of snapshots) {
    const month = snapshot.as_of_date.slice(0, 7);
    const accountMonths = snapshotsByAccount.get(snapshot.social_account_id) ?? new Map<string, SocialSnapshot>();
    const current = accountMonths.get(month);
    if (!current || snapshot.as_of_date > current.as_of_date
      || (snapshot.as_of_date === current.as_of_date && snapshot.created_at > current.created_at)
      || (snapshot.as_of_date === current.as_of_date && snapshot.created_at === current.created_at && snapshot.id > current.id)) {
      accountMonths.set(month, snapshot);
    }
    snapshotsByAccount.set(snapshot.social_account_id, accountMonths);
  }

  return accounts.map((account) => {
    const accountMonths = snapshotsByAccount.get(account.id) ?? new Map<string, SocialSnapshot>();
    const points: SocialMonthlyAudiencePoint[] = Array.from({ length: 12 }, (_, index) => {
      const month = shiftMonth(firstDisplayMonth, index);
      const current = accountMonths.get(month);
      const previous = accountMonths.get(shiftMonth(month, -1));
      const growthCount = current && previous ? current.audience_count - previous.audience_count : null;
      const growthPercent = growthCount === null || !previous || previous.audience_count === 0
        ? null
        : Math.round((growthCount / previous.audience_count) * 10_000) / 100;

      return {
        month: `${month}-01`,
        as_of_date: current?.as_of_date ?? null,
        audience_count: current?.audience_count ?? null,
        growth_count: growthCount,
        growth_percent: growthPercent,
        comparison_snapshot: current && previous
          ? { as_of_date: previous.as_of_date, audience_count: previous.audience_count }
          : null,
      };
    });

    return { ...account, points };
  });
}

export function isAllowedSocialUrl(platform: SocialPlatform, value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ALLOWED_HOSTS[platform].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

function mutationContext(actorId: string, key: unknown, reason: unknown): SocialMutationContext {
  const idempotencyKey = requiredText(key, 'Kunci idempotensi', 128, 8);
  const changeReason = requiredText(reason, 'Alasan perubahan', 500, 5);
  if (!actorId) throw new SocialMediaServiceError(401, 'SOCIAL_ACTOR_NOT_FOUND', 'Identitas akun belum terhubung ke data pengguna.');
  return { actorId, idempotencyKey, changeReason };
}

function failRepository(error: unknown): never {
  const message = databaseErrorMessage(error)?.trim() || (error instanceof Error ? error.message : '');
  const code = databaseErrorCode(error);
  const mapped: Record<string, [number, string, string]> = {
    SOCIAL_ACCOUNT_NOT_FOUND: [404, 'SOCIAL_ACCOUNT_NOT_FOUND', 'Akun media sosial tidak ditemukan.'],
    SOCIAL_PUBLICATION_NOT_FOUND: [404, 'SOCIAL_PUBLICATION_NOT_FOUND', 'Publikasi tidak ditemukan.'],
    SOCIAL_INSIGHT_PERIOD_NOT_FOUND: [404, 'SOCIAL_INSIGHT_PERIOD_NOT_FOUND', 'Periode statistik tidak ditemukan.'],
    SOCIAL_VERSION_CONFLICT: [409, 'SOCIAL_VERSION_CONFLICT', 'Data berubah sejak terakhir dimuat. Muat ulang lalu coba lagi.'],
    SOCIAL_IDEMPOTENCY_REUSED: [409, 'SOCIAL_IDEMPOTENCY_REUSED', 'Kunci idempotensi sudah dipakai untuk data lain.'],
    SOCIAL_EVIDENCE_UPLOAD_IN_PROGRESS: [409, 'SOCIAL_EVIDENCE_UPLOAD_IN_PROGRESS', 'Selesaikan atau batalkan unggahan sebelumnya terlebih dahulu.'],
    SOCIAL_EVIDENCE_ALREADY_COMPLETED: [409, 'SOCIAL_EVIDENCE_ALREADY_COMPLETED', 'Unggahan ini sudah diselesaikan.'],
    SOCIAL_EVIDENCE_NOT_FOUND: [404, 'SOCIAL_EVIDENCE_NOT_FOUND', 'Bukti unggahan tidak ditemukan atau sudah kedaluwarsa.'],
    SOCIAL_EVIDENCE_EXPIRED: [410, 'SOCIAL_EVIDENCE_EXPIRED', 'Unggahan sudah kedaluwarsa. Mulai unggah kembali.'],
    SOCIAL_PUBLICATION_NOT_DRAFT: [409, 'SOCIAL_PUBLICATION_NOT_DRAFT', 'Hanya publikasi draft yang dapat direkam.'],
    SOCIAL_INSIGHT_PERIOD_NOT_DRAFT: [409, 'SOCIAL_INSIGHT_PERIOD_NOT_DRAFT', 'Hanya statistik draft yang dapat direkam.'],
    SOCIAL_STORY_EVIDENCE_REQUIRED: [422, 'SOCIAL_STORY_EVIDENCE_REQUIRED', 'Story Instagram/TikTok wajib memiliki minimal satu foto bukti yang sudah diverifikasi.'],
    SOCIAL_INSIGHT_EVIDENCE_REQUIRED: [422, 'SOCIAL_INSIGHT_EVIDENCE_REQUIRED', 'Statistik wajib memiliki minimal satu foto grafik yang sudah diverifikasi.'],
    SOCIAL_ARCHIVE_PERIOD_INVALID: [422, 'SOCIAL_ARCHIVE_PERIOD_INVALID', 'Periode arsip bulanan tidak sesuai bulan yang dipilih.'],
    SOCIAL_ARCHIVE_METRICS_INVALID: [422, 'SOCIAL_ARCHIVE_METRICS_INVALID', 'Isi setidaknya satu metrik yang tersedia untuk platform akun ini.'],
    SOCIAL_ARCHIVE_LEGACY_METRIC_INVALID: [422, 'SOCIAL_ARCHIVE_METRICS_INVALID', 'Metrik arsip harus sesuai dengan platform akun.'],
    SOCIAL_ARCHIVE_ALREADY_EXISTS: [409, 'SOCIAL_ARCHIVE_ALREADY_EXISTS', 'Arsip untuk akun dan bulan ini sudah ada. Lanjutkan draft yang tersedia atau pilih bulan lain.'],
    SOCIAL_PUBLICATION_LINK_REQUIRED: [422, 'SOCIAL_PUBLICATION_LINK_REQUIRED', 'Konten ini wajib memiliki tautan publikasi.'],
    SOCIAL_PUBLICATION_LINK_INVALID: [422, 'SOCIAL_PUBLICATION_LINK_INVALID', 'Tautan publikasi harus HTTPS dari platform akun tersebut.'],
    SOCIAL_PLATFORM_MISMATCH: [422, 'SOCIAL_PLATFORM_MISMATCH', 'Jenis konten dan platform akun tidak sesuai.'],
    SOCIAL_ACCOUNT_INACTIVE: [422, 'SOCIAL_ACCOUNT_INACTIVE', 'Akun ini sudah tidak aktif. Pilih akun resmi yang aktif.'],
    SOCIAL_ACCOUNT_DUPLICATE: [409, 'SOCIAL_ACCOUNT_DUPLICATE', 'Nama akun ini sudah tercatat untuk platform tersebut.'],
    SOCIAL_PUBLICATION_EVIDENCE_REQUIRED: [422, 'SOCIAL_PUBLICATION_EVIDENCE_REQUIRED', 'Publikasi Channel WhatsApp memerlukan tautan WhatsApp atau minimal satu foto bukti.'],
    SOCIAL_REPORT_ROW_LIMIT: [422, 'SOCIAL_REPORT_ROW_LIMIT', 'Data laporan melewati batas aman 5.000 baris. Persempit filter akun atau hubungi admin.'],
    SOCIAL_REPORT_MONTH_INVALID: [422, 'SOCIAL_REPORT_MONTH_INVALID', 'Pilih satu bulan kalender yang sudah selesai untuk laporan.'],
  };
  if (mapped[message]) {
    const [statusCode, errorCode, publicMessage] = mapped[message]!;
    throw new SocialMediaServiceError(statusCode, errorCode, publicMessage);
  }
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code || '')) {
    throw new SocialMediaServiceError(503, 'SOCIAL_MEDIA_SCHEMA_UNAVAILABLE', 'Skema fitur media sosial belum terpasang.');
  }
  throw new SocialMediaServiceError(400, 'SOCIAL_MEDIA_REQUEST_FAILED', message && !/[{}]/.test(message) ? message : 'Permintaan media sosial tidak dapat diproses.');
}

function mapEvidencePublic(evidence: SocialEvidence, includeAccess = false): Omit<SocialEvidence, 'object_key' | 'publication_id' | 'insight_period_id'> {
  const { object_key: _key, publication_id: _publicationId, insight_period_id: _insightId, ...safe } = evidence;
  if (!includeAccess) {
    const { access_url: _url, expires_in_seconds: _expires, ...metadata } = safe;
    return metadata;
  }
  return safe;
}

function addSnapshotGrowth(rows: SocialSnapshot[], baselines: SocialSnapshot[] = []): SocialSnapshot[] {
  const previousByAccount = new Map<string, SocialSnapshot>(baselines.map((item) => [item.social_account_id, item]));
  return [...rows].sort((a, b) => a.as_of_date.localeCompare(b.as_of_date) || a.id.localeCompare(b.id)).map((item) => {
    const prior = previousByAccount.get(item.social_account_id);
    const growth = prior === undefined ? null : item.audience_count - prior.audience_count;
    previousByAccount.set(item.social_account_id, item);
    return {
      ...item,
      growth_count: growth,
      growth_percent: prior === undefined || prior.audience_count === 0 ? null : Math.round((growth! / prior.audience_count) * 10_000) / 100,
      comparison_snapshot: prior ? { as_of_date: prior.as_of_date, audience_count: prior.audience_count } : null,
    };
  });
}

export class SocialMediaService {
  constructor(private readonly repository: SocialMediaRepository) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async accounts(includeInactive = false) {
    const result = await this.repository.listAccounts(includeInactive);
    if ('error' in result) failRepository(result.error);
    return result.data;
  }

  async createAccount(input: { platform: SocialPlatform; account_name: string; account_url: string }, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    if (!['instagram', 'tiktok', 'youtube', 'whatsapp'].includes(input.platform)) throw new SocialMediaServiceError(422, 'SOCIAL_PLATFORM_INVALID', 'Platform belum didukung.');
    const accountName = requiredText(input.account_name, 'Nama akun', 120, 2);
    const accountUrl = requiredText(input.account_url, 'URL akun', 500, 12);
    if (!isAllowedSocialUrl(input.platform, accountUrl)) throw new SocialMediaServiceError(422, 'SOCIAL_ACCOUNT_URL_INVALID', 'URL akun harus HTTPS dan berasal dari platform yang dipilih.');
    const result = await this.repository.createAccount({ ...context, platform: input.platform, account_name: accountName, account_url: accountUrl });
    if ('error' in result) failRepository(result.error);
    return result;
  }

  async updateAccount(id: string, input: { account_name?: string; account_url?: string; is_active?: boolean; expected_version: number }, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    if (!Number.isInteger(input.expected_version) || input.expected_version < 1) throw new SocialMediaServiceError(422, 'SOCIAL_VERSION_INVALID', 'Versi data tidak valid.');
    const existing = (await this.accounts(true)).find((account) => account.id === id);
    if (!existing) throw new SocialMediaServiceError(404, 'SOCIAL_ACCOUNT_NOT_FOUND', 'Akun media sosial tidak ditemukan.');
    const accountName = input.account_name === undefined ? existing.account_name : requiredText(input.account_name, 'Nama akun', 120, 2);
    const accountUrl = input.account_url === undefined ? existing.account_url : requiredText(input.account_url, 'URL akun', 500, 12);
    if (!isAllowedSocialUrl(existing.platform, accountUrl)) throw new SocialMediaServiceError(422, 'SOCIAL_ACCOUNT_URL_INVALID', 'URL akun harus HTTPS dan berasal dari platform yang dipilih.');
    const result = await this.repository.updateAccount({ ...context, id, expectedVersion: input.expected_version, account_name: accountName, account_url: accountUrl, is_active: input.is_active });
    if ('error' in result) failRepository(result.error);
    return result.data;
  }

  async publications(query: { from?: string; to?: string; platform?: string; page?: string; pageSize?: string }) {
    const { from, to } = this.dateRange(query.from, query.to, 366);
    const platform = query.platform ? this.platform(query.platform) : undefined;
    const page = this.integerQuery(query.page, 1, 10_000, 'page');
    const pageSize = this.integerQuery(query.pageSize, 20, MAX_PAGE_SIZE, 'pageSize');
    const result = await this.repository.listPublications({ from, to, platform, page, pageSize });
    if ('error' in result) failRepository(result.error);
    return { ...result, data: result.data.map((publication) => this.publicationPublic(publication)) };
  }

  async createPublication(input: { social_account_id: string; content_type: string; caption: string; published_at: string; platform_url?: string; status?: 'draft' | 'recorded' }, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    const accountId = requiredText(input.social_account_id, 'Akun resmi', 64);
    const account = (await this.accounts()).find((item) => item.id === accountId);
    if (!account) throw new SocialMediaServiceError(422, 'SOCIAL_ACCOUNT_INACTIVE', 'Pilih akun media sosial resmi yang aktif.');
    if (!CONTENT_TYPES[account.platform].includes(input.content_type)) throw new SocialMediaServiceError(422, 'SOCIAL_PLATFORM_MISMATCH', 'Jenis konten tidak sesuai dengan platform akun.');
    if (!validDate(input.published_at) || input.published_at > jakartaToday()) throw new SocialMediaServiceError(422, 'SOCIAL_DATE_INVALID', 'Tanggal publikasi harus valid dan tidak boleh di masa depan.');
    const caption = requiredText(input.caption, 'Uraian konten', 5_000, 3);
    const platformUrl = input.platform_url ? requiredText(input.platform_url, 'Tautan publikasi', 500, 12) : '';
    const story = (account.platform === 'instagram' || account.platform === 'tiktok') && input.content_type === 'story';
    if (!story && account.platform !== 'whatsapp' && !platformUrl) throw new SocialMediaServiceError(422, 'SOCIAL_PUBLICATION_LINK_REQUIRED', 'Tautan publikasi wajib diisi untuk konten ini.');
    if (platformUrl && !isAllowedSocialUrl(account.platform, platformUrl)) throw new SocialMediaServiceError(422, 'SOCIAL_PUBLICATION_LINK_INVALID', 'Tautan harus HTTPS dan berasal dari platform akun tersebut.');
    if (input.status === 'recorded' && (story || (account.platform === 'whatsapp' && !platformUrl))) {
      throw new SocialMediaServiceError(422, story ? 'SOCIAL_STORY_EVIDENCE_REQUIRED' : 'SOCIAL_PUBLICATION_EVIDENCE_REQUIRED', 'Simpan sebagai draft, unggah foto bukti, lalu rekam publikasi.');
    }
    const result = await this.repository.createPublication({
      ...context, social_account_id: account.id, platform: account.platform, content_type: input.content_type,
      caption, published_at: input.published_at, platform_url: platformUrl || null,
      status: input.status || 'draft',
    });
    if ('error' in result) failRepository(result.error);
    return { ...result, data: this.publicationPublic(result.data) };
  }

  async finalizePublication(id: string, expectedVersion: number, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new SocialMediaServiceError(422, 'SOCIAL_VERSION_INVALID', 'Versi data tidak valid.');
    const existing = await this.repository.getPublication(id);
    if ('error' in existing) failRepository(existing.error);
    if (!existing.data) throw new SocialMediaServiceError(404, 'SOCIAL_PUBLICATION_NOT_FOUND', 'Publikasi tidak ditemukan.');
    const publication = existing.data;
    const attached = publication.evidence.filter((item) => item.upload_status === 'attached');
    const isStory = (publication.platform === 'instagram' || publication.platform === 'tiktok') && publication.content_type === 'story';
    if (isStory && attached.length === 0) throw new SocialMediaServiceError(422, 'SOCIAL_STORY_EVIDENCE_REQUIRED', 'Story Instagram/TikTok wajib memiliki minimal satu foto bukti yang sudah diunggah.');
    if (publication.platform === 'whatsapp' && publication.content_type === 'channel_post' && !publication.platform_url && attached.length === 0) {
      throw new SocialMediaServiceError(422, 'SOCIAL_PUBLICATION_EVIDENCE_REQUIRED', 'Posting Channel WhatsApp memerlukan tautan WhatsApp atau minimal satu foto bukti.');
    }
    const result = await this.repository.finalizePublication({ ...context, id, expectedVersion });
    if ('error' in result) failRepository(result.error);
    return this.publicationPublic(result.data);
  }

  async reserveEvidence(kind: 'publication' | 'insight_period', parentId: string, input: { file_name: string; content_type: string; file_size_bytes: number }, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    const fileName = requiredText(input.file_name, 'Nama file', 255);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.content_type) || !Number.isInteger(input.file_size_bytes) || input.file_size_bytes < 1 || input.file_size_bytes > MAX_UPLOAD_BYTES) {
      throw new SocialMediaServiceError(422, 'SOCIAL_EVIDENCE_INVALID', 'Bukti harus berupa JPEG, PNG, atau WebP maksimal 5 MB.');
    }
    const parent = kind === 'publication'
      ? await this.repository.getPublication(parentId)
      : await this.getInsightPeriod(parentId);
    if ('error' in parent) failRepository(parent.error);
    if (!parent.data || parent.data.status !== 'draft') throw new SocialMediaServiceError(409, 'SOCIAL_PARENT_NOT_DRAFT', 'Bukti hanya dapat ditambahkan pada data draft.');
    let upload: ReturnType<typeof generateR2PrivateUploadUrl>;
    try { upload = generateR2PrivateUploadUrl(fileName, `social-media/${kind}/${parentId}`, input.content_type); }
    catch { throw new SocialMediaServiceError(503, 'SOCIAL_MEDIA_STORAGE_UNAVAILABLE', 'Penyimpanan bukti belum tersedia.'); }
    const result = await this.repository.reserveEvidence({ ...context, parentKind: kind, parentId, objectKey: upload.key, fileName, contentType: input.content_type, fileSizeBytes: input.file_size_bytes, expiresInSeconds: upload.expiresInSeconds });
    if ('error' in result) failRepository(result.error);
    const signed = result.data.object_key && result.data.object_key !== upload.key ? generateR2PrivateUploadUrlForKey(result.data.object_key, input.content_type) : upload;
    return { evidence: mapEvidencePublic(result.data), upload_url: signed.uploadUrl, expires_in_seconds: signed.expiresInSeconds, idempotent_replay: result.idempotentReplay };
  }

  async completeEvidence(kind: 'publication' | 'insight_period', parentId: string, evidenceId: string, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    const found = await this.repository.getEvidence(kind, parentId, evidenceId);
    if ('error' in found) failRepository(found.error);
    const objectKey = found.data?.object_key;
    if (!found.data || !objectKey) throw new SocialMediaServiceError(404, 'SOCIAL_EVIDENCE_NOT_FOUND', 'Unggahan bukti tidak ditemukan atau sudah kedaluwarsa.');
    const evidence = found.data;
    if (evidence.upload_status === 'attached') {
      const access = generateR2PrivateAccessUrl(objectKey);
      return { evidence: mapEvidencePublic(evidence), access_url: access.accessUrl, expires_in_seconds: access.expiresInSeconds, idempotent_replay: true };
    }
    let inspection: { exists: boolean; contentType?: string; contentLength?: number };
    let validImage = false;
    try {
      inspection = await inspectCloudflareR2Object(objectKey);
      validImage = await verifyCloudflareR2ImageObject(objectKey, evidence.mime_type);
    } catch { throw new SocialMediaServiceError(503, 'SOCIAL_EVIDENCE_VERIFY_FAILED', 'Bukti belum dapat diverifikasi. Coba lagi.'); }
    if (!inspection.exists || inspection.contentLength !== evidence.file_size_bytes || inspection.contentType !== evidence.mime_type || !validImage) {
      throw new SocialMediaServiceError(422, 'SOCIAL_EVIDENCE_INVALID', 'Isi file bukti tidak sesuai dengan metadata yang dikirim.');
    }
    const result = await this.repository.completeEvidence({ ...context, parentKind: kind, parentId, evidenceId });
    if ('error' in result) failRepository(result.error);
    const access = generateR2PrivateAccessUrl(result.data.object_key || '');
    return { evidence: mapEvidencePublic(result.data), access_url: access.accessUrl, expires_in_seconds: access.expiresInSeconds };
  }

  async evidenceAccess(kind: 'publication' | 'insight_period', parentId: string) {
    const parent = kind === 'publication' ? await this.repository.getPublication(parentId) : await this.getInsightPeriod(parentId);
    if ('error' in parent) failRepository(parent.error);
    if (!parent.data) throw new SocialMediaServiceError(404, 'SOCIAL_PARENT_NOT_FOUND', 'Data media sosial tidak ditemukan.');
    const evidence = await this.repository.listEvidence(kind, [parentId]);
    if ('error' in evidence) failRepository(evidence.error);
    return evidence.data.flatMap((item) => item.object_key ? [{ id: item.id, access_url: generateR2PrivateAccessUrl(item.object_key).accessUrl, expires_in_seconds: 900 }] : []);
  }

  async createSnapshot(input: { social_account_id: string; as_of_date: string; audience_count: number }, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    const account = (await this.accounts()).find((item) => item.id === input.social_account_id);
    if (!account) throw new SocialMediaServiceError(422, 'SOCIAL_ACCOUNT_INACTIVE', 'Pilih akun media sosial resmi yang aktif.');
    if (!validDate(input.as_of_date) || input.as_of_date > jakartaToday()) throw new SocialMediaServiceError(422, 'SOCIAL_DATE_INVALID', 'Tanggal snapshot harus valid dan tidak boleh di masa depan.');
    if (!Number.isSafeInteger(input.audience_count) || input.audience_count < 0) throw new SocialMediaServiceError(422, 'SOCIAL_METRIC_INVALID', 'Jumlah pengikut harus bilangan bulat nol atau lebih.');
    const result = await this.repository.createSnapshot({ ...context, social_account_id: account.id, as_of_date: input.as_of_date, audience_count: input.audience_count });
    if ('error' in result) failRepository(result.error);
    return { ...result, data: result.data };
  }

  async createInsightPeriod(input: CreateSocialInsightInput, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    const account = (await this.accounts()).find((item) => item.id === input.social_account_id);
    if (!account) throw new SocialMediaServiceError(422, 'SOCIAL_ACCOUNT_INACTIVE', 'Pilih akun media sosial resmi yang aktif.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.archive_month) || input.archive_month >= jakartaToday().slice(0, 7)) {
      throw new SocialMediaServiceError(422, 'SOCIAL_ARCHIVE_PERIOD_INVALID', 'Pilih bulan arsip yang sudah selesai.');
    }
    const [year, month] = input.archive_month.split('-').map(Number);
    const monthStart = `${input.archive_month}-01`;
    const monthEnd = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
    const periodStart = account.platform === 'whatsapp'
      ? new Date(Date.parse(`${monthEnd}T00:00:00.000Z`) - 29 * 86_400_000).toISOString().slice(0, 10)
      : monthStart;
    const metricKeys = ALL_INSIGHT_METRICS;
    for (const keyName of metricKeys) {
      const value = input[keyName];
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new SocialMediaServiceError(422, 'SOCIAL_METRIC_INVALID', 'Metrik harus berupa bilangan bulat nol atau lebih.');
    }
    const supportedMetrics = INSIGHT_METRICS[account.platform];
    const supportedMetricSet = new Set<string>(supportedMetrics);
    if (metricKeys.some((keyName) => input[keyName] !== undefined && !supportedMetricSet.has(keyName))) {
      throw new SocialMediaServiceError(422, 'SOCIAL_ARCHIVE_METRICS_INVALID', 'Metrik yang dikirim tidak tersedia untuk platform akun ini.');
    }
    if (!supportedMetrics.some((keyName) => input[keyName] !== undefined)) {
      throw new SocialMediaServiceError(422, 'SOCIAL_ARCHIVE_METRICS_INVALID', 'Isi setidaknya satu metrik yang tersedia untuk platform akun ini.');
    }
    const notes = typeof input.notes === 'string' ? requiredText(input.notes, 'Catatan', 2_000, 0) : '';
    const result = await this.repository.createInsightPeriod({
      ...context, social_account_id: account.id, archive_month: monthStart, period_start: periodStart, period_end: monthEnd,
      ...Object.fromEntries(metricKeys.map((keyName) => [keyName, input[keyName] ?? null])), notes,
    });
    if ('error' in result) failRepository(result.error);
    return { ...result, data: this.insightPublic(result.data) };
  }

  async metrics(fromValue?: string, toValue?: string) {
    const { from, to } = this.dateRange(fromValue, toValue, 366);
    const [snapshotsResult, insightResult] = await Promise.all([
      this.repository.listSnapshots(from, to), this.repository.listInsightPeriods(from, to),
    ]);
    if ('error' in snapshotsResult) failRepository(snapshotsResult.error);
    if ('error' in insightResult) failRepository(insightResult.error);
    const accountIds = [...new Set(snapshotsResult.data.map((item) => item.social_account_id))];
    const baselinesResult = await this.repository.listSnapshotBaselines(from, accountIds);
    if ('error' in baselinesResult) failRepository(baselinesResult.error);
    const snapshots = addSnapshotGrowth(snapshotsResult.data, baselinesResult.data);
    return {
      snapshots,
      insight_periods: insightResult.data.map((item) => this.insightPublic(item)),
    };
  }

  async updateInsightPeriod(id: string, expectedVersion: number, actorId: string, key: unknown, reason: unknown) {
    const context = mutationContext(actorId, key, reason);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new SocialMediaServiceError(422, 'SOCIAL_VERSION_INVALID', 'Versi data tidak valid.');
    const current = await this.getInsightPeriod(id);
    if ('error' in current) failRepository(current.error);
    if (!current.data) throw new SocialMediaServiceError(404, 'SOCIAL_INSIGHT_PERIOD_NOT_FOUND', 'Periode statistik tidak ditemukan.');
    const evidence = current.data.evidence.filter((item) => item.upload_status === 'attached');
    if (evidence.length < 1) throw new SocialMediaServiceError(422, 'SOCIAL_INSIGHT_EVIDENCE_REQUIRED', 'Statistik wajib memiliki minimal satu foto grafik yang sudah diunggah.');
    const result = await this.repository.finalizeInsightPeriod({ ...context, id, expectedVersion });
    if ('error' in result) failRepository(result.error);
    return this.insightPublic(result.data);
  }

  async reports(fromValue?: string, toValue?: string) {
    const { from, to } = this.dateRange(fromValue, toValue, MAX_REPORT_RANGE_DAYS);
    const selectedMonth = from.slice(0, 7);
    const expectedRange = monthRange(selectedMonth);
    const currentMonthStart = `${jakartaToday().slice(0, 7)}-01`;
    if (from !== expectedRange.from || to !== expectedRange.to || to >= currentMonthStart) {
      throw new SocialMediaServiceError(422, 'SOCIAL_REPORT_MONTH_INVALID', 'Pilih satu bulan kalender yang sudah selesai untuk laporan.');
    }

    const firstDisplayMonth = shiftMonth(selectedMonth, -11);
    const trendFrom = `${shiftMonth(firstDisplayMonth, -1)}-01`;
    const [result, accountResult] = await Promise.all([
      this.repository.reportData(from, to, trendFrom, MAX_REPORT_ROWS_PER_SECTION),
      this.repository.listAccounts(false),
    ]);
    if ('error' in result) failRepository(result.error);
    if ('error' in accountResult) failRepository(accountResult.error);
    const pubEvidence = await this.repository.listEvidence('publication', result.publications.map((item) => item.id));
    const insightEvidence = await this.repository.listEvidence('insight_period', result.insight_periods.map((item) => item.id));
    if ('error' in pubEvidence) failRepository(pubEvidence.error);
    if ('error' in insightEvidence) failRepository(insightEvidence.error);
    const pubGrouped = this.groupEvidence(pubEvidence.data);
    const insightGrouped = this.groupEvidence(insightEvidence.data);
    const publications = result.publications.map((item) => this.publicationPublic({ ...item, evidence: this.evidenceWithAccess(pubGrouped.get(item.id) || []) }));
    const insightPeriods = result.insight_periods.map((item) => this.insightPublic({ ...item, evidence: this.evidenceWithAccess(insightGrouped.get(item.id) || []) }));
    const accountMap = new Map(accountResult.data.map(({ id, platform, account_name, is_active }) => [id, { id, platform, account_name, is_active }]));
    for (const account of result.accounts) {
      if (!accountMap.has(account.id)) accountMap.set(account.id, account);
    }
    const accounts = [...accountMap.values()]
      .sort((left, right) => left.platform.localeCompare(right.platform) || left.account_name.localeCompare(right.account_name));
    const monthlyGrowth = monthlyAudienceSeries(accounts, result.snapshots, firstDisplayMonth);
    return {
      range: { from, to }, trend_range: { from: `${firstDisplayMonth}-01`, to }, complete: true, truncated: false,
      totals: { publications: publications.length, accounts: monthlyGrowth.length, insight_periods: insightPeriods.length,
        evidence_images: publications.reduce((sum, publication) => sum + publication.evidence.length, 0)
          + insightPeriods.reduce((sum, period) => sum + period.evidence.length, 0) },
      monthly_growth: monthlyGrowth, publications, insight_periods: insightPeriods,
    };
  }

  private async getInsightPeriod(id: string): Promise<{ data: SocialInsightPeriod | null } | { error: unknown }> {
    const result = await this.repository.getInsightPeriod(id);
    if ('error' in result) return result;
    return result;
  }

  private publicationPublic(item: SocialPublication): SocialPublication {
    return { ...item, evidence: item.evidence.map((evidence) => mapEvidencePublic(evidence, Boolean(evidence.access_url))) as SocialEvidence[] };
  }

  private insightPublic(item: SocialInsightPeriod): SocialInsightPeriod {
    return { ...item, evidence: item.evidence.map((evidence) => mapEvidencePublic(evidence, Boolean(evidence.access_url))) as SocialEvidence[] };
  }

  private evidenceWithAccess(items: SocialEvidence[]): SocialEvidence[] {
    return items.map((item) => {
      if (!item.object_key) return mapEvidencePublic(item) as SocialEvidence;
      const access = generateR2PrivateAccessUrl(item.object_key);
      return mapEvidencePublic({ ...item, access_url: access.accessUrl, expires_in_seconds: access.expiresInSeconds }, true) as SocialEvidence;
    });
  }

  private groupEvidence(items: SocialEvidence[]): Map<string, SocialEvidence[]> {
    const grouped = new Map<string, SocialEvidence[]>();
    for (const item of items) {
      const parentId = item.publication_id || item.insight_period_id;
      if (!parentId) continue;
      grouped.set(parentId, [...(grouped.get(parentId) || []), item]);
    }
    return grouped;
  }

  private dateRange(fromValue: unknown, toValue: unknown, maxDays: number): { from: string; to: string } {
    const from = fromValue === undefined ? jakartaToday() : fromValue;
    const to = toValue === undefined ? from : toValue;
    if (!validDate(from) || !validDate(to) || from > to || dateRangeDays(from, to) > maxDays) {
      throw new SocialMediaServiceError(422, 'SOCIAL_DATE_RANGE_INVALID', `Rentang tanggal harus valid dan maksimal ${maxDays} hari.`);
    }
    return { from, to };
  }

  private platform(value: string): SocialPlatform {
    if (['instagram', 'tiktok', 'youtube', 'whatsapp'].includes(value)) return value as SocialPlatform;
    throw new SocialMediaServiceError(422, 'SOCIAL_PLATFORM_INVALID', 'Platform belum didukung.');
  }

  private integerQuery(value: unknown, fallback: number, max: number, name: string): number {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new SocialMediaServiceError(422, 'SOCIAL_PAGINATION_INVALID', `Parameter ${name} belum valid.`);
    return parsed;
  }
}
