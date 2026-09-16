import crypto from 'node:crypto';
import type { JwtPayload } from '../../shared/auth/auth.types.js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import { borrowingMutationStatus, getBorrowingErrorMessage, isIsoDate, isMissingBorrowingSchemaError } from './borrowing.helpers.js';
import type { BorrowingMutationsRepository } from './borrowing.mutations.repository.js';
import { generateR2PrivateAccessUrl, generateR2PrivateUploadUrl, inspectCloudflareR2Object } from '../../services/cloudflareR2Service.js';
import type { BorrowingApprovalInput, BorrowingCreateInput, BorrowingReturnEvidenceAccessRecord, BorrowingReturnEvidenceStorage, BorrowingReturnEvidenceUploadInput, BorrowingReturnInput } from './borrowing.mutations.types.js';

export class BorrowingMutationsServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BorrowingMutationsServiceError';
  }
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function repositoryFailure(error: unknown, fallback: string): never {
  const databaseError = asDatabaseError(error);
  const schemaUnavailable = isMissingBorrowingSchemaError(databaseError);
  const statusCode = schemaUnavailable ? 503 : borrowingMutationStatus(databaseError);
  const errorCode = schemaUnavailable ? 'BORROWING_SCHEMA_UNAVAILABLE' : databaseError?.code || 'BORROWING_MUTATION_FAILED';
  throw new BorrowingMutationsServiceError(statusCode, errorCode, schemaUnavailable ? getBorrowingErrorMessage(databaseError) : (getBorrowingErrorMessage(databaseError) || fallback), error);
}

function ensureId(value: unknown, field: string): string {
  const normalized = nonEmpty(value);
  if (!normalized || normalized.length > 128) throw new BorrowingMutationsServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  return normalized;
}

function ensureDate(value: unknown, field: string): string {
  const normalized = nonEmpty(value);
  if (!normalized || !isIsoDate(normalized)) throw new BorrowingMutationsServiceError(422, 'INVALID_DATE', `${field} harus berupa tanggal kalender yang valid (YYYY-MM-DD).`);
  return normalized;
}

const RETURN_CONDITIONS = new Set(['bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'hilang']);
const PHYSICAL_RETURN_CONDITIONS = new Set(['bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar']);
const ALLOWED_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_EVIDENCE_BYTES = 600 * 1024;
const MIN_RETURN_EVIDENCE_COUNT = 2;
const MAX_RETURN_EVIDENCE_COUNT = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultReturnEvidenceStorage: BorrowingReturnEvidenceStorage = {
  createUpload: generateR2PrivateUploadUrl,
  inspect: inspectCloudflareR2Object,
  createAccess: generateR2PrivateAccessUrl,
};

function ensureEvidenceIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_INVALID', 'Daftar foto kondisi tidak valid.');
  if (value.length > MAX_RETURN_EVIDENCE_COUNT) throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_INVALID', `Maksimal ${MAX_RETURN_EVIDENCE_COUNT} foto kondisi dapat diunggah per alat.`);
  const ids = value.map((candidate) => nonEmpty(candidate));
  if (ids.some((candidate) => !candidate || !UUID_PATTERN.test(candidate))) throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_INVALID', 'ID foto kondisi tidak valid.');
  const normalized = ids as string[];
  if (new Set(normalized).size !== normalized.length) throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_INVALID', 'Foto kondisi tidak boleh duplikat.');
  return normalized;
}

export class BorrowingMutationsService {
  constructor(
    private readonly repository: BorrowingMutationsRepository,
    private readonly evidenceStorage: BorrowingReturnEvidenceStorage = defaultReturnEvidenceStorage,
  ) {}

  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async create(input: BorrowingCreateInput, actor: Pick<JwtPayload, 'userId' | 'role'>, memberStudentId: string | null, actorId: string, requestIdempotencyKey?: string) {
    const studentId = ensureId(input.student_id || input.borrower_id, 'student_id');
    if (actor.role === 'member' && (!memberStudentId || memberStudentId !== studentId)) {
      throw new BorrowingMutationsServiceError(403, 'FORBIDDEN', 'Siswa hanya boleh mengajukan peminjaman untuk dirinya sendiri.');
    }
    const equipmentIds = Array.isArray(input.equipment_ids) ? input.equipment_ids.map((value) => ensureId(value, 'equipment_id')) : [];
    if (equipmentIds.length === 0) throw new BorrowingMutationsServiceError(422, 'EQUIPMENT_REQUIRED', 'Minimal satu alat wajib dipilih.');
    if (new Set(equipmentIds).size !== equipmentIds.length) throw new BorrowingMutationsServiceError(422, 'DUPLICATE_EQUIPMENT', 'Daftar alat tidak boleh berisi duplikasi.');
    if (equipmentIds.length > 50) throw new BorrowingMutationsServiceError(422, 'TOO_MANY_EQUIPMENT', 'Maksimal 50 alat dapat diajukan dalam satu peminjaman.');

    const tanggalPinjam = input.tanggal_pinjam ? ensureDate(input.tanggal_pinjam, 'tanggal_pinjam') : new Date().toISOString().slice(0, 10);
    const rencanaKembali = ensureDate(input.rencana_kembali || input.due_at?.slice(0, 10), 'rencana_kembali');
    if (rencanaKembali < tanggalPinjam) throw new BorrowingMutationsServiceError(422, 'INVALID_DATE_RANGE', 'Rencana tanggal pengembalian harus sama atau setelah tanggal peminjaman.');
    const keperluan = nonEmpty(input.keperluan || input.keterangan);
    if (!keperluan || keperluan.length < 5 || keperluan.length > 500) throw new BorrowingMutationsServiceError(422, 'INVALID_PURPOSE', 'Keperluan peminjaman minimal 5 dan maksimal 500 karakter.');
    const idempotencyKey = nonEmpty(requestIdempotencyKey) || nonEmpty(input.idempotency_key) || `bor-${actor.userId}-${crypto.randomUUID()}`;
    const result = await this.repository.create({ studentId, equipmentIds, tanggalPinjam, rencanaKembali, keperluan, actorId, idempotencyKey });
    if (result.error) repositoryFailure(result.error, 'Pengajuan peminjaman gagal disimpan.');
    if (!result.data) throw new BorrowingMutationsServiceError(500, 'BORROWING_DETAIL_UNAVAILABLE', 'Pengajuan tersimpan tetapi detailnya gagal dimuat.');
    return result.data;
  }

  async approveReject(borrowingId: string, input: BorrowingApprovalInput, actorId: string) {
    const id = ensureId(borrowingId, 'borrowing_id');
    if (input.action !== 'approve' && input.action !== 'reject') throw new BorrowingMutationsServiceError(422, 'INVALID_ACTION', 'Aksi persetujuan tidak valid.');
    const changeReason = nonEmpty(input.change_reason) || nonEmpty(input.alasan);
    if (!changeReason || changeReason.length < 5) throw new BorrowingMutationsServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan keputusan minimal 5 karakter.');
    const catatan = nonEmpty(input.catatan);
    const result = await this.repository.approveReject({ borrowingId: id, action: input.action, catatan, actorId, changeReason });
    if (result.error) repositoryFailure(result.error, 'Keputusan peminjaman gagal diproses.');
    if (!result.data) throw new BorrowingMutationsServiceError(404, 'NOT_FOUND', 'Peminjaman tidak ditemukan.');
    return result.data;
  }

  async handover(borrowingId: string, actorId: string, changeReason: string) {
    const id = ensureId(borrowingId, 'borrowing_id');
    const reason = nonEmpty(changeReason);
    if (!reason || reason.length < 5) throw new BorrowingMutationsServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan serah-terima minimal 5 karakter.');
    const result = await this.repository.handover({ borrowingId: id, actorId, changeReason: reason });
    if (result.error) repositoryFailure(result.error, 'Serah-terima peminjaman gagal diproses.');
    if (!result.data) throw new BorrowingMutationsServiceError(404, 'NOT_FOUND', 'Peminjaman tidak ditemukan.');
    return result.data;
  }

  async returnBorrowing(borrowingId: string, input: BorrowingReturnInput, actorId: string, headerChangeReason?: string) {
    const id = ensureId(borrowingId, 'borrowing_id');
    const reason = nonEmpty(headerChangeReason) || nonEmpty(input.change_reason);
    if (!reason || reason.length < 5) throw new BorrowingMutationsServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan pengembalian minimal 5 karakter.');
    const itemConditions = Array.isArray(input.item_conditions) ? input.item_conditions : [];
    if (itemConditions.length === 0) throw new BorrowingMutationsServiceError(422, 'ITEM_CONDITIONS_REQUIRED', 'Kondisi setiap alat wajib diisi.');
    if (new Set(itemConditions.map((item) => item.equipment_id)).size !== itemConditions.length) throw new BorrowingMutationsServiceError(422, 'DUPLICATE_EQUIPMENT', 'Kondisi alat tidak boleh duplikat.');
    const returnedAt = input.tanggal_dikembalikan ? ensureDate(input.tanggal_dikembalikan, 'tanggal_dikembalikan') : new Date().toISOString().slice(0, 10);
    const catatan = nonEmpty(input.catatan_pengembalian);
    for (const item of itemConditions) {
      ensureId(item.equipment_id, 'equipment_id');
      if (nonEmpty(item.kondisi_kembali) === null) throw new BorrowingMutationsServiceError(422, 'INVALID_CONDITION', 'Kondisi setiap alat wajib diisi.');
      if (!RETURN_CONDITIONS.has(item.kondisi_kembali)) throw new BorrowingMutationsServiceError(422, 'INVALID_CONDITION', 'Kondisi pengembalian alat tidak valid.');
      if (item.settlement_method !== undefined && !['none', 'repair', 'replacement'].includes(item.settlement_method)) throw new BorrowingMutationsServiceError(422, 'INVALID_SETTLEMENT_METHOD', 'Metode penyelesaian tidak valid.');
      if (item.repair_cost !== undefined && (!Number.isFinite(Number(item.repair_cost)) || Number(item.repair_cost) <= 0)) throw new BorrowingMutationsServiceError(422, 'INVALID_REPAIR_COST', 'Biaya perbaikan harus lebih besar dari 0.');
      const evidenceIds = ensureEvidenceIds(item.evidence_ids);
      if (PHYSICAL_RETURN_CONDITIONS.has(item.kondisi_kembali) && evidenceIds.length < MIN_RETURN_EVIDENCE_COUNT) {
        throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_REQUIRED', `Minimal ${MIN_RETURN_EVIDENCE_COUNT} foto kondisi wajib diunggah untuk alat yang kembali.`);
      }
      await Promise.all(evidenceIds.map((evidenceId) => this.assertReturnEvidenceUploaded(id, item.equipment_id, evidenceId, actorId)));
    }
    const result = await this.repository.returnBorrowing({ borrowingId: id, returnedAt, itemConditions, catatan, actorId, changeReason: reason });
    if (result.error) repositoryFailure(result.error, 'Pengembalian peminjaman gagal diproses.');
    if (!result.data) throw new BorrowingMutationsServiceError(404, 'NOT_FOUND', 'Peminjaman tidak ditemukan.');
    return result.data;
  }

  async previewReturn(borrowingId: string, input: BorrowingReturnInput) {
    const id = ensureId(borrowingId, 'borrowing_id');
    const returnedAt = input.tanggal_dikembalikan ? ensureDate(input.tanggal_dikembalikan, 'tanggal_dikembalikan') : new Date().toISOString().slice(0, 10);
    const itemConditions = Array.isArray(input.item_conditions) ? input.item_conditions : [];
    if (itemConditions.length === 0) throw new BorrowingMutationsServiceError(422, 'ITEM_CONDITIONS_REQUIRED', 'Kondisi setiap alat wajib diisi.');
    if (new Set(itemConditions.map((item) => item.equipment_id)).size !== itemConditions.length) throw new BorrowingMutationsServiceError(422, 'DUPLICATE_EQUIPMENT', 'Kondisi alat tidak boleh duplikat.');
    for (const item of itemConditions) {
      ensureId(item.equipment_id, 'equipment_id');
      if (nonEmpty(item.kondisi_kembali) === null) throw new BorrowingMutationsServiceError(422, 'INVALID_CONDITION', 'Kondisi setiap alat wajib diisi.');
      if (!RETURN_CONDITIONS.has(item.kondisi_kembali)) throw new BorrowingMutationsServiceError(422, 'INVALID_CONDITION', 'Kondisi pengembalian alat tidak valid.');
      if (item.settlement_method !== undefined && !['none', 'repair', 'replacement'].includes(item.settlement_method)) throw new BorrowingMutationsServiceError(422, 'INVALID_SETTLEMENT_METHOD', 'Metode penyelesaian tidak valid.');
    }
    const result = await this.repository.previewReturn({ borrowingId: id, returnedAt, itemConditions });
    if (result.error) repositoryFailure(result.error, 'Perhitungan pengembalian gagal.');
    if (!result.data) throw new BorrowingMutationsServiceError(404, 'NOT_FOUND', 'Peminjaman tidak ditemukan.');
    return result.data;
  }

  async reserveReturnEvidence(
    borrowingId: string,
    input: BorrowingReturnEvidenceUploadInput,
    actorId: string,
  ) {
    const id = ensureId(borrowingId, 'borrowing_id');
    const equipmentId = ensureId(input.equipment_id, 'equipment_id');
    const fileName = ensureId(input.file_name, 'file_name');
    const contentType = nonEmpty(input.content_type)?.toLowerCase();
    const fileSizeBytes = Number(input.file_size_bytes);
    if (!contentType || !ALLOWED_EVIDENCE_TYPES.has(contentType)
      || !Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > MAX_EVIDENCE_BYTES) {
      throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_FILE_INVALID', 'Foto harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 600 KB.');
    }

    let upload: ReturnType<BorrowingReturnEvidenceStorage['createUpload']>;
    try {
      upload = this.evidenceStorage.createUpload(fileName, `borrowing-return-evidence/${id}/${equipmentId}`);
    } catch {
      throw new BorrowingMutationsServiceError(503, 'RETURN_EVIDENCE_STORAGE_UNAVAILABLE', 'Penyimpanan foto kondisi sedang tidak tersedia.');
    }
    const result = await this.repository.reserveReturnEvidence({
      borrowingId: id,
      equipmentId,
      objectKey: upload.key,
      mimeType: contentType,
      fileSizeBytes,
      originalFilename: fileName,
      actorId,
    });
    if (result.error) repositoryFailure(result.error, 'Gagal menyiapkan unggahan foto kondisi.');
    if (!result.data) throw new BorrowingMutationsServiceError(500, 'RETURN_EVIDENCE_UNAVAILABLE', 'Data unggahan foto kondisi tidak tersedia.');
    return {
      evidence_id: result.data.id,
      upload_url: upload.uploadUrl,
      expires_in_seconds: upload.expiresInSeconds,
    };
  }

  private async assertReturnEvidenceUploaded(
    borrowingId: string,
    equipmentId: string,
    evidenceId: string,
    actorId: string,
  ) {
    const result = await this.repository.getReturnEvidence(evidenceId);
    if (result.error) repositoryFailure(result.error, 'Gagal memeriksa foto kondisi.');
    const evidence = result.data;
    if (!evidence || evidence.borrowing_id !== borrowingId || evidence.equipment_id !== equipmentId
      || evidence.created_by !== actorId || evidence.storage_provider !== 'r2' || evidence.upload_status !== 'pending') {
      throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_INVALID', 'Foto kondisi tidak sesuai dengan alat atau peminjaman ini.');
    }
    let object: Awaited<ReturnType<BorrowingReturnEvidenceStorage['inspect']>>;
    try {
      object = await this.evidenceStorage.inspect(evidence.object_key);
    } catch {
      throw new BorrowingMutationsServiceError(503, 'RETURN_EVIDENCE_STORAGE_UNAVAILABLE', 'Foto kondisi belum dapat diverifikasi dari penyimpanan.');
    }
    if (!object.exists || (object.contentType && object.contentType.toLowerCase() !== evidence.mime_type.toLowerCase())
      || (object.contentLength != null && object.contentLength !== evidence.file_size_bytes)) {
      throw new BorrowingMutationsServiceError(422, 'RETURN_EVIDENCE_UPLOAD_INCOMPLETE', 'Unggahan foto kondisi belum selesai atau ukurannya berubah.');
    }
    return evidence;
  }

  async getReturnEvidenceAccess(evidenceId: string) {
    const id = ensureId(evidenceId, 'evidence_id');
    const result = await this.repository.getReturnEvidence(id);
    if (result.error) repositoryFailure(result.error, 'Gagal memuat foto kondisi.');
    const evidence = result.data;
    if (!evidence || evidence.upload_status !== 'attached') {
      throw new BorrowingMutationsServiceError(404, 'RETURN_EVIDENCE_NOT_FOUND', 'Foto kondisi tidak ditemukan.');
    }
    try {
      const access = this.evidenceStorage.createAccess(evidence.object_key);
      return { access_url: access.accessUrl, expires_in_seconds: access.expiresInSeconds };
    } catch {
      throw new BorrowingMutationsServiceError(503, 'RETURN_EVIDENCE_STORAGE_UNAVAILABLE', 'Foto kondisi sedang tidak dapat dibuka.');
    }
  }

  async listReturnEvidence(borrowingId: string): Promise<BorrowingReturnEvidenceAccessRecord[]> {
    const id = ensureId(borrowingId, 'borrowing_id');
    const result = await this.repository.listReturnEvidence(id);
    if (result.error) repositoryFailure(result.error, 'Gagal memuat foto kondisi.');
    const evidence = result.data || [];
    try {
      return evidence.map((item) => {
        const access = this.evidenceStorage.createAccess(item.object_key);
        return {
          evidence_id: item.id,
          borrowing_id: item.borrowing_id,
          borrowing_item_id: item.borrowing_item_id,
          equipment_id: item.equipment_id,
          assessment_item_id: item.assessment_item_id,
          original_filename: item.original_filename,
          mime_type: item.mime_type,
          file_size_bytes: item.file_size_bytes,
          created_at: item.created_at,
          access_url: access.accessUrl,
          expires_in_seconds: access.expiresInSeconds,
        };
      });
    } catch {
      throw new BorrowingMutationsServiceError(503, 'RETURN_EVIDENCE_STORAGE_UNAVAILABLE', 'Foto kondisi sedang tidak dapat dibuka.');
    }
  }
}
