import { databaseErrorCode } from '../../shared/database/database.types.js';
import {
  generateR2PrivateAccessUrl,
  generateR2PrivateUploadUrl,
  inspectCloudflareR2Object,
} from '../../services/cloudflareR2Service.js';
import { cleanEntryText, entryErrorMessage } from './contest-entries.helpers.js';
import { CONTEST_WORK_TYPES } from './contest-entries.types.js';
import type {
  ContestEntriesRepository,
  ContestEntryMutationContext,
  ContestEvidenceStorage,
  ContestFinalizeResultKind,
  CreateContestEntryInput,
  FinalizeContestEntryInput,
  ReserveContestEvidenceInput,
  TransitionContestEntryInput,
  ContestWorkTypeRecord,
} from './contest-entries.types.js';

export class ContestEntriesServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string, public readonly details?: unknown) { super(message); this.name = 'ContestEntriesServiceError'; }
}

function required(value: unknown, field: string, maxLength = 200): string {
  const text = cleanEntryText(value, maxLength);
  if (!text) throw new ContestEntriesServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  return text;
}

function optionalUrl(value: unknown, field: string): string | undefined {
  const text = cleanEntryText(value, 2048) ?? undefined;
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
  } catch {
    throw new ContestEntriesServiceError(422, 'INVALID_URL', `${field} harus berupa URL http atau https yang valid.`);
  }
  return text;
}

function mapRepositoryError(error: unknown, fallback: string): never {
  const code = databaseErrorCode(error);
  const message = typeof (error as { message?: unknown } | null)?.message === 'string'
    ? String((error as { message: string }).message).trim()
    : '';
  const businessCodes = new Set([
    'CONTEST_NOT_FOUND', 'WORK_NOT_FOUND', 'WORK_TYPE_INVALID', 'WORK_TITLE_INVALID',
    'CONTEST_ENTRY_ALREADY_EXISTS', 'CONTEST_ENTRY_STATUS_INVALID',
    'CONTEST_ENTRY_EVIDENCE_REQUIRED', 'CONTEST_ENTRY_EVIDENCE_INVALID',
    'CONTEST_ENTRY_EVIDENCE_NOT_ALLOWED', 'CONTEST_ENTRY_TRANSITION_INVALID',
    'CONTEST_ENTRY_ACTOR_INVALID', 'CONTEST_ENTRY_ACTOR_FORBIDDEN',
    'CONTEST_EVIDENCE_TARGET_INVALID', 'CONTEST_EVIDENCE_FILE_INVALID',
    'CONTEST_EVIDENCE_ACTOR_FORBIDDEN', 'CONTEST_FINALIZE_OUTCOME_INVALID',
    'CONTEST_FINALIZE_RESULT_REQUIRED', 'CONTEST_FINALIZE_RESULT_NOT_ALLOWED',
    'CONTEST_FINALIZE_RESULT_ITEM_INVALID', 'CONTEST_FINALIZE_POSITION_INVALID',
    'CONTEST_FINALIZE_POSITION_REQUIRED', 'CONTEST_FINALIZE_EVIDENCE_INVALID',
    'CHANGE_REASON_REQUIRED',
  ]);
  if (businessCodes.has(message)) {
    const statusCode = businessErrorStatus(message);
    throw new ContestEntriesServiceError(statusCode, message, entryErrorMessage(error, fallback));
  }
  throw new ContestEntriesServiceError(getDatabaseErrorStatus(code), getDatabaseErrorCode(code), entryErrorMessage(error, fallback));
}

function businessErrorStatus(message: string): number {
  if (message === 'CONTEST_ENTRY_ALREADY_EXISTS') return 409;
  if (message === 'CONTEST_NOT_FOUND' || message === 'WORK_NOT_FOUND') return 404;
  return 422;
}

function getDatabaseErrorStatus(code: string | undefined): number {
  if (code === '23505') return 409;
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code || '')) return 503;
  if (code === 'PGRST116') return 404;
  return 400;
}

function getDatabaseErrorCode(code: string | undefined): string {
  if (code === '23505') return 'CONTEST_ENTRY_ALREADY_EXISTS';
  if (code === 'PGRST116') return 'CONTEST_ENTRY_NOT_FOUND';
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code || '')) return 'CONTEST_ENTRY_SCHEMA_UNAVAILABLE';
  return 'CONTEST_ENTRY_FAILED';
}

const defaultEvidenceStorage: ContestEvidenceStorage = {
  createUpload: generateR2PrivateUploadUrl,
  inspect: inspectCloudflareR2Object,
  createAccess: generateR2PrivateAccessUrl,
};

const ALLOWED_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

function requiredIdentity(actorId: string | null): string {
  if (!actorId) throw new ContestEntriesServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
  return actorId;
}

function requiredIdempotencyKey(context: ContestEntryMutationContext): ContestEntryMutationContext {
  const key = cleanEntryText(context.idempotencyKey, 128);
  if (!key || key.length < 8) throw new ContestEntriesServiceError(422, 'CONTEST_ENTRY_IDEMPOTENCY_INVALID', 'Kunci idempotensi permintaan tidak valid.');
  return { ...context, idempotencyKey: key };
}

export class ContestEntriesService {
  constructor(
    private readonly repository: ContestEntriesRepository,
    private readonly evidenceStorage: ContestEvidenceStorage = defaultEvidenceStorage,
  ) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async listWorkTypes(): Promise<ContestWorkTypeRecord[]> {
    const result = await this.repository.listWorkTypes();
    if ('error' in result) mapRepositoryError(result.error, 'Gagal memuat jenis karya.');
    return result.data;
  }

  async list(contestId: string, query: { page?: string; pageSize?: string; status?: string }) {
    const id = required(contestId, 'contest_id', 64);
    const result = await this.repository.list(id, query);
    if ('error' in result) mapRepositoryError(result.error, 'Gagal memuat daftar karya lomba.');
    return result;
  }

  async get(entryId: string) {
    const id = required(entryId, 'entry_id', 64);
    const result = await this.repository.get(id);
    if ('error' in result) mapRepositoryError(result.error, 'Gagal memuat detail karya lomba.');
    if (!result.data) throw new ContestEntriesServiceError(404, 'CONTEST_ENTRY_NOT_FOUND', 'Karya lomba tidak ditemukan.');
    return result.data;
  }

  async create(input: CreateContestEntryInput, actorId: string | null) {
    actorId = requiredIdentity(actorId);
    const contestId = required(input.contest_id, 'contest_id', 64);
    const workId = cleanEntryText(input.work_id, 64) || undefined;
    const work = input.work;
    if ((workId && work) || (!workId && !work)) throw new ContestEntriesServiceError(422, 'WORK_TARGET_INVALID', 'Pilih karya yang sudah ada atau isi karya baru, bukan keduanya.');
    const normalizedWork = work ? {
      title: required(work.title, 'title'),
      work_type_code: required(work.work_type_code, 'work_type_code', 64),
      description: cleanEntryText(work.description, 2000) ?? undefined,
      primary_asset_url: optionalUrl(work.primary_asset_url, 'primary_asset_url'),
      video_url: optionalUrl(work.video_url, 'video_url'),
    } : undefined;
    if (normalizedWork && !CONTEST_WORK_TYPES.includes(normalizedWork.work_type_code as (typeof CONTEST_WORK_TYPES)[number])) {
      throw new ContestEntriesServiceError(422, 'WORK_TYPE_INVALID', 'Jenis karya tidak dikenali.');
    }
    const result = await this.repository.create({ contestId, workId, work: normalizedWork, actorId });
    if ('error' in result) mapRepositoryError(result.error, 'Gagal mendaftarkan karya ke lomba.');
    return result.data;
  }

  async reserveEvidence(entryId: string, input: ReserveContestEvidenceInput, actorId: string | null) {
    actorId = requiredIdentity(actorId);
    const normalizedEntryId = required(entryId, 'entry_id', 64);
    const targetStatus = cleanEntryText(input.target_status, 32);
    if (targetStatus !== 'sudah_terkirim' && targetStatus !== 'selesai') {
      throw new ContestEntriesServiceError(422, 'CONTEST_EVIDENCE_TARGET_INVALID', 'Bukti hanya dapat diunggah untuk status Sudah Terkirim atau Selesai.');
    }
    const fileName = required(input.file_name, 'file_name', 255);
    const contentType = cleanEntryText(input.content_type, 100)?.toLowerCase();
    const fileSizeBytes = Number(input.file_size_bytes);
    if (!contentType || !ALLOWED_EVIDENCE_TYPES.has(contentType)
        || !Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > MAX_EVIDENCE_BYTES) {
      throw new ContestEntriesServiceError(422, 'CONTEST_EVIDENCE_FILE_INVALID', 'Bukti harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.');
    }

    let upload: ReturnType<ContestEvidenceStorage['createUpload']>;
    try {
      upload = this.evidenceStorage.createUpload(fileName, `contest-evidence/${normalizedEntryId}/${targetStatus}`);
    } catch {
      throw new ContestEntriesServiceError(503, 'CONTEST_EVIDENCE_STORAGE_UNAVAILABLE', 'Penyimpanan bukti sedang tidak tersedia.');
    }
    const result = await this.repository.reserveEvidence({
      entryId: normalizedEntryId,
      targetStatus,
      objectKey: upload.key,
      mimeType: contentType,
      fileSizeBytes,
      originalFilename: fileName,
      actorId,
    });
    if ('error' in result) mapRepositoryError(result.error, 'Gagal menyiapkan unggahan bukti.');
    return {
      evidence_id: result.data.id,
      upload_url: upload.uploadUrl,
      expires_in_seconds: upload.expiresInSeconds,
    };
  }

  private async assertEvidenceUploaded(entryId: string, evidenceId: string, targetStatus: 'sudah_terkirim' | 'selesai') {
    const result = await this.repository.getEvidence(evidenceId);
    if ('error' in result) mapRepositoryError(result.error, 'Gagal memeriksa bukti unggahan.');
    const evidence = result.data;
    if (!evidence || evidence.entry_id !== entryId || evidence.target_status !== targetStatus
        || evidence.storage_provider !== 'r2' || evidence.upload_status !== 'pending'
        || !evidence.object_key || !evidence.mime_type || !evidence.file_size_bytes) {
      throw new ContestEntriesServiceError(422, 'CONTEST_ENTRY_EVIDENCE_INVALID', 'Bukti unggahan tidak sesuai dengan perubahan status ini.');
    }
    let object: Awaited<ReturnType<ContestEvidenceStorage['inspect']>>;
    try {
      object = await this.evidenceStorage.inspect(evidence.object_key);
    } catch {
      throw new ContestEntriesServiceError(503, 'CONTEST_EVIDENCE_STORAGE_UNAVAILABLE', 'Bukti belum dapat diverifikasi dari penyimpanan.');
    }
    if (!object.exists
        || (object.contentType && object.contentType.toLowerCase() !== evidence.mime_type.toLowerCase())
        || (object.contentLength != null && object.contentLength !== evidence.file_size_bytes)) {
      throw new ContestEntriesServiceError(422, 'CONTEST_EVIDENCE_UPLOAD_INCOMPLETE', 'Unggahan bukti belum selesai atau metadata file tidak sesuai.');
    }
    return evidence;
  }

  async transition(
    entryId: string,
    input: TransitionContestEntryInput,
    actorId: string | null,
    context: ContestEntryMutationContext,
  ) {
    actorId = requiredIdentity(actorId);
    const normalizedEntryId = required(entryId, 'entry_id', 64);
    const status = cleanEntryText(input.status, 32);
    if (status !== 'sudah_terkirim' && status !== 'menunggu_pengumuman') {
      throw new ContestEntriesServiceError(422, 'CONTEST_ENTRY_STATUS_INVALID', 'Gunakan endpoint finalisasi untuk menyelesaikan pipeline karya.');
    }
    const changeReason = required(input.change_reason, 'change_reason', 500);
    const evidenceId = cleanEntryText(input.evidence_id, 64) ?? undefined;
    if (status === 'sudah_terkirim') {
      if (!evidenceId) throw new ContestEntriesServiceError(422, 'CONTEST_ENTRY_EVIDENCE_REQUIRED', 'Unggah bukti pengiriman karya terlebih dahulu.');
      await this.assertEvidenceUploaded(normalizedEntryId, evidenceId, 'sudah_terkirim');
    } else if (evidenceId) {
      throw new ContestEntriesServiceError(422, 'CONTEST_ENTRY_EVIDENCE_NOT_ALLOWED', 'Status Menunggu Pengumuman tidak memerlukan bukti baru.');
    }
    const result = await this.repository.transition({
      entryId: normalizedEntryId,
      status,
      evidenceId,
      changeReason,
      actorId,
      context: requiredIdempotencyKey(context),
    });
    if ('error' in result) mapRepositoryError(result.error, 'Gagal memperbarui status karya lomba.');
    return result.data;
  }

  async finalize(
    entryId: string,
    input: FinalizeContestEntryInput,
    actorId: string | null,
    context: ContestEntryMutationContext,
  ) {
    actorId = requiredIdentity(actorId);
    const normalizedEntryId = required(entryId, 'entry_id', 64);
    const outcomeStatus = cleanEntryText(input.outcome_status, 32);
    if (outcomeStatus !== 'awarded' && outcomeStatus !== 'not_awarded') {
      throw new ContestEntriesServiceError(422, 'CONTEST_FINALIZE_OUTCOME_INVALID', 'Pilih apakah karya mendapat penghargaan atau tidak.');
    }
    const evidenceId = required(input.evidence_id, 'evidence_id', 64);
    const changeReason = required(input.change_reason, 'change_reason', 500);
    const rawResults = Array.isArray(input.results) ? input.results : [];
    if (outcomeStatus === 'awarded' && rawResults.length === 0) {
      throw new ContestEntriesServiceError(422, 'CONTEST_FINALIZE_RESULT_REQUIRED', 'Tambahkan minimal satu hasil penghargaan.');
    }
    if (outcomeStatus === 'not_awarded' && rawResults.length > 0) {
      throw new ContestEntriesServiceError(422, 'CONTEST_FINALIZE_RESULT_NOT_ALLOWED', 'Hasil penghargaan harus kosong jika karya tidak mendapat penghargaan.');
    }
    if (rawResults.length > 20) throw new ContestEntriesServiceError(422, 'CONTEST_FINALIZE_RESULTS_INVALID', 'Maksimal 20 hasil penghargaan per karya.');
    const results = rawResults.map((item) => {
      const kind = cleanEntryText(item.result_kind, 32);
      if (!kind || !(['rank', 'finalist', 'nominee', 'other'] as const).includes(kind as ContestFinalizeResultKind)) {
        throw new ContestEntriesServiceError(422, 'CONTEST_FINALIZE_RESULT_ITEM_INVALID', 'Jenis penghargaan tidak valid.');
      }
      const title = required(item.result_title, 'result_title', 200);
      const position = item.position == null ? null : Number(item.position);
      if (position != null && (!Number.isSafeInteger(position) || position < 1 || position > 100000)) {
        throw new ContestEntriesServiceError(422, 'CONTEST_FINALIZE_POSITION_INVALID', 'Posisi juara harus berupa angka positif.');
      }
      if (kind === 'rank' && position == null) {
        throw new ContestEntriesServiceError(422, 'CONTEST_FINALIZE_POSITION_REQUIRED', 'Posisi wajib diisi untuk jenis Juara.');
      }
      return { result_kind: kind as ContestFinalizeResultKind, result_title: title, position };
    });
    await this.assertEvidenceUploaded(normalizedEntryId, evidenceId, 'selesai');
    const result = await this.repository.finalize({
      entryId: normalizedEntryId,
      outcomeStatus,
      results,
      evidenceId,
      changeReason,
      actorId,
      context: requiredIdempotencyKey(context),
    });
    if ('error' in result) mapRepositoryError(result.error, 'Gagal menyelesaikan pipeline karya lomba.');
    return { entry: result.data, results: result.results };
  }

  async getEvidenceAccess(evidenceId: string) {
    const result = await this.repository.getEvidence(required(evidenceId, 'evidence_id', 64));
    if ('error' in result) mapRepositoryError(result.error, 'Gagal memuat bukti.');
    const evidence = result.data;
    if (!evidence || evidence.upload_status !== 'attached') {
      throw new ContestEntriesServiceError(404, 'CONTEST_EVIDENCE_NOT_FOUND', 'Bukti tidak ditemukan.');
    }
    if (evidence.storage_provider === 'legacy_url' && evidence.public_url) {
      return { access_url: evidence.public_url, expires_in_seconds: null };
    }
    if (!evidence.object_key) throw new ContestEntriesServiceError(404, 'CONTEST_EVIDENCE_NOT_FOUND', 'Bukti tidak ditemukan.');
    try {
      const access = this.evidenceStorage.createAccess(evidence.object_key);
      return { access_url: access.accessUrl, expires_in_seconds: access.expiresInSeconds };
    } catch {
      throw new ContestEntriesServiceError(503, 'CONTEST_EVIDENCE_STORAGE_UNAVAILABLE', 'Bukti sedang tidak dapat dibuka.');
    }
  }
}
