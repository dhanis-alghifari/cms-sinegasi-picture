import { asDatabaseError } from '../../shared/database/database.types.js';
import { generateR2PrivateAccessUrl, generateR2PrivateUploadUrl, inspectCloudflareR2Object } from '../../services/cloudflareR2Service.js';
import { validatePhotoUrl } from './equipment.helpers.js';
import type {
  EquipmentEvidenceType,
  ChargePaymentEventInput,
  ChargePaymentInput,
  EquipmentChargeSettlement,
  EquipmentRecoveryCase,
  EquipmentRecoveryRepository,
  RecoveryCreateInput,
  RecoveryRepairInput,
  RecoveryReplacementInput,
  RecoveryStatusFilter,
} from './equipment.recovery.types.js';

export class EquipmentRecoveryServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) { super(message); this.name = 'EquipmentRecoveryServiceError'; }
}

const conditionMap: Readonly<Record<string, string>> = {
  minor_damage: 'sedikit_kerusakan', damaged: 'rusak', severely_damaged: 'rusak_besar', under_repair: 'sedang_diperbaiki', lost: 'hilang',
};
const categoryMap: Readonly<Record<string, string>> = { camera: 'Kamera', lens: 'Lensa', audio: 'Audio', lighting: 'Lighting', accessory: 'Aksesoris', other: 'Lainnya' };
const recoveryTypes = new Set(['repair', 'replacement']);
const recoveryStatuses = new Set<RecoveryStatusFilter>(['active', 'history', 'open', 'in_progress', 'awaiting_verification', 'completed', 'unrepairable', 'cancelled']);
const chargeStatuses = new Set(['unpaid', 'partial', 'paid', 'waived']);
const evidenceTypes = new Set<EquipmentEvidenceType>(['payment', 'repair', 'replacement']);
const evidenceMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxEvidenceBytes = 600 * 1024;
const evidenceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) throw new EquipmentRecoveryServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  return value.trim();
}

function optionalText(value: unknown, max = 2000): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.trim().length > max) throw new EquipmentRecoveryServiceError(422, 'INVALID_INPUT', 'Teks yang dikirim terlalu panjang.');
  return value.trim() || undefined;
}

function id(value: unknown, field: string): string { return text(value, field, 128); }

function reason(value: unknown): string { return text(value, 'Alasan perubahan', 500); }

function repositoryFailure(error: unknown, fallback: string): never {
  const databaseError = asDatabaseError(error);
  // PostgreSQL raises domain errors with SQLSTATE P0001 and puts the stable
  // application code in `message`; prefer that code for a consistent API.
  const messageCode = databaseError?.message?.trim();
  const code = messageCode && /^[A-Z][A-Z0-9_]+$/.test(messageCode)
    ? messageCode
    : databaseError?.code || 'RECOVERY_OPERATION_FAILED';
  if (['42P01', '42703', 'PGRST202', 'PGRST205', '42883'].includes(code)) {
    throw new EquipmentRecoveryServiceError(503, 'RECOVERY_SCHEMA_UNAVAILABLE', 'Fitur tindak lanjut alat belum aktif di database. Jalankan migration 063_equipment_recovery_and_charges.sql dan 064_equipment_charge_payment_evidence.sql lalu muat ulang aplikasi.');
  }
  if (code === '23514' && /equipment_charge/i.test(`${databaseError?.message || ''} ${databaseError?.details || ''}`)) {
    throw new EquipmentRecoveryServiceError(422, 'CHARGE_AMOUNT_INVALID', 'Jumlah pembayaran tidak sesuai dengan status atau sisa tagihan.');
  }
  const messages: Record<string, string> = {
    EQUIPMENT_NOT_FOUND: 'Alat tidak ditemukan.', EQUIPMENT_STILL_BORROWED: 'Alat masih dipinjam dan belum dapat diproses.',
    RECOVERY_CASE_ALREADY_OPEN: 'Alat sudah memiliki tindak lanjut yang belum selesai.', RECOVERY_CASE_NOT_FOUND: 'Tindak lanjut alat tidak ditemukan.', RECOVERY_CASE_NOT_OPEN: 'Tindak lanjut ini sudah selesai atau tidak dapat diubah.',
    RECOVERY_ASSESSMENT_LINK_INVALID: 'Tautan pemeriksaan pengembalian tidak sesuai dengan alat.', RECOVERY_TYPE_INVALID: 'Jenis tindak lanjut tidak valid.', RECOVERY_CASE_TYPE_INVALID: 'Jenis tindak lanjut tidak sesuai dengan proses yang dipilih.',
    RECOVERY_CONDITION_INVALID: 'Kondisi alat untuk tindak lanjut tidak valid.', RECOVERY_IDENTITY_INVALID: 'Identitas pengguna atau tindak lanjut tidak valid.', RECOVERY_CHANGE_REASON_REQUIRED: 'Alasan perubahan wajib diisi.',
    RECOVERY_EVIDENCE_REQUIRED: 'Minimal 2 foto hasil pemeriksaan wajib diunggah.', RECOVERY_INSPECTION_REQUIRED: 'Checklist pemeriksaan akhir wajib dikonfirmasi.',
    RECOVERY_EVIDENCE_INVALID: 'Foto hasil pemeriksaan tidak valid.', REPLACEMENT_PHOTOS_REQUIRED: 'Minimal 3 foto alat pengganti wajib diunggah.',
    REPLACEMENT_PHOTOS_INVALID: 'Foto alat pengganti tidak valid.', EQUIPMENT_CODE_ALREADY_EXISTS: 'Kode alat sudah digunakan.',
    STUDENT_HAS_OUTSTANDING_EQUIPMENT_CHARGE: 'Peminjam masih memiliki tagihan alat yang belum lunas.', CHARGE_SETTLEMENT_NOT_FOUND: 'Tagihan alat tidak ditemukan.', CHARGE_IDENTITY_INVALID: 'Identitas pengguna atau tagihan tidak valid.', CHARGE_CHANGE_REASON_REQUIRED: 'Alasan perubahan wajib diisi.', CHARGE_BORROWING_LINK_INVALID: 'Tagihan tidak terhubung ke transaksi peminjaman yang valid.',
    CHARGE_EVIDENCE_REQUIRED: 'Bukti pembayaran wajib diunggah.', CHARGE_RESOLUTION_EVIDENCE_REQUIRED: 'Bukti penyelesaian alat belum lengkap. Unggah foto perbaikan atau penggantian sebelum tagihan dilunasi.', CHARGE_EVIDENCE_INVALID: 'Bukti pembayaran tidak sesuai dengan tagihan ini.', CHARGE_EVIDENCE_FILE_INVALID: 'Foto harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 600 KB.', CHARGE_EVIDENCE_UPLOAD_INCOMPLETE: 'Unggahan bukti belum selesai atau ukurannya berubah.',
  };
  const notFoundCodes = ['EQUIPMENT_NOT_FOUND', 'RECOVERY_CASE_NOT_FOUND', 'CHARGE_SETTLEMENT_NOT_FOUND'];
  const validationCodes = ['RECOVERY_EVIDENCE_REQUIRED', 'RECOVERY_EVIDENCE_INVALID', 'RECOVERY_INSPECTION_REQUIRED', 'RECOVERY_INSPECTION_INVALID', 'REPLACEMENT_PHOTOS_REQUIRED', 'REPLACEMENT_PHOTOS_INVALID', 'RECOVERY_ASSESSMENT_LINK_INVALID', 'RECOVERY_TYPE_INVALID', 'RECOVERY_CASE_TYPE_INVALID', 'RECOVERY_CONDITION_INVALID', 'RECOVERY_IDENTITY_INVALID', 'RECOVERY_CHANGE_REASON_REQUIRED', 'REPLACEMENT_EQUIPMENT_REQUIRED', 'INVALID_REPLACEMENT_VALUE', 'CHARGE_STATUS_INVALID', 'CHARGE_AMOUNT_INVALID', 'CHARGE_IDENTITY_INVALID', 'CHARGE_CHANGE_REASON_REQUIRED', 'CHARGE_BORROWING_LINK_INVALID', 'CHARGE_EVIDENCE_REQUIRED', 'CHARGE_RESOLUTION_EVIDENCE_REQUIRED', 'CHARGE_EVIDENCE_INVALID', 'CHARGE_EVIDENCE_FILE_INVALID', 'CHARGE_EVIDENCE_UPLOAD_INCOMPLETE'];
  const conflictCodes = ['RECOVERY_CASE_ALREADY_OPEN', 'RECOVERY_CASE_NOT_OPEN', 'EQUIPMENT_CODE_ALREADY_EXISTS', 'STUDENT_HAS_OUTSTANDING_EQUIPMENT_CHARGE'];
  let statusCode = 500;
  if (notFoundCodes.includes(code)) statusCode = 404;
  else if (validationCodes.includes(code)) statusCode = 422;
  else if (conflictCodes.includes(code)) statusCode = 409;
  throw new EquipmentRecoveryServiceError(statusCode, code, messages[code] || fallback);
}

function photos(value: unknown, minimum: number): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > 12) throw new EquipmentRecoveryServiceError(422, 'RECOVERY_EVIDENCE_REQUIRED', `Minimal ${minimum} foto wajib diunggah.`);
  const values = value.map((candidate) => typeof candidate === 'string' ? candidate.trim() : '');
  if (values.some((candidate) => !candidate || !validatePhotoUrl(candidate))) throw new EquipmentRecoveryServiceError(422, 'RECOVERY_EVIDENCE_INVALID', 'Foto yang dikirim tidak valid.');
  return values;
}

export class EquipmentRecoveryService {
  constructor(private readonly repository: EquipmentRecoveryRepository) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async listCases(query: { equipment_id?: string; status?: string }): Promise<EquipmentRecoveryCase[]> {
    const equipmentId = query.equipment_id ? id(query.equipment_id, 'equipment_id') : undefined;
    const status = query.status ? text(query.status, 'status', 40) : undefined;
    if (status && !recoveryStatuses.has(status as RecoveryStatusFilter)) throw new EquipmentRecoveryServiceError(422, 'INVALID_STATUS', 'Status tindak lanjut alat tidak valid.');
    const result = await this.repository.listCases({ equipmentId, status: status as RecoveryStatusFilter | undefined });
    if (result.error) repositoryFailure(result.error, 'Daftar tindak lanjut alat gagal dimuat.');
    return result.data;
  }

  async createCase(body: Record<string, unknown>, actorId: string): Promise<EquipmentRecoveryCase> {
    const equipmentId = id(body.equipment_id, 'equipment_id');
    const recoveryType = text(body.recovery_type, 'recovery_type', 20);
    if (!recoveryTypes.has(recoveryType)) throw new EquipmentRecoveryServiceError(422, 'INVALID_RECOVERY_TYPE', 'Jenis tindak lanjut harus perbaikan atau penggantian.');
    const conditionCode = text(body.reported_condition, 'reported_condition', 40);
    const reportedCondition = conditionMap[conditionCode];
    if (!reportedCondition) throw new EquipmentRecoveryServiceError(422, 'INVALID_CONDITION', 'Kondisi alat untuk tindak lanjut tidak valid.');
    if (reportedCondition === 'hilang' && recoveryType !== 'replacement') throw new EquipmentRecoveryServiceError(422, 'INVALID_RECOVERY_TYPE', 'Alat yang hilang harus ditindaklanjuti dengan penggantian unit.');
    const result = await this.repository.createCase({ equipmentId, recoveryType: recoveryType as RecoveryCreateInput['recoveryType'], assessmentItemId: body.assessment_item_id ? id(body.assessment_item_id, 'assessment_item_id') : undefined, reportedCondition, notes: optionalText(body.notes), actorId, changeReason: reason(body.change_reason) });
    if (result.error || !result.data) repositoryFailure(result.error, 'Tindak lanjut alat gagal dibuat.');
    return result.data;
  }

  async completeRepair(body: Record<string, unknown>, actorId: string) {
    const actualCost = body.actual_cost === undefined || body.actual_cost === null || body.actual_cost === '' ? undefined : Number(body.actual_cost);
    if (actualCost !== undefined && (!Number.isFinite(actualCost) || actualCost < 0)) throw new EquipmentRecoveryServiceError(422, 'INVALID_COST', 'Biaya aktual tidak valid.');
    if (body.inspection_passed !== true) throw new EquipmentRecoveryServiceError(422, 'RECOVERY_INSPECTION_REQUIRED', 'Checklist pemeriksaan akhir wajib dikonfirmasi.');
    const result = await this.repository.completeRepair({ caseId: id(body.case_id, 'case_id'), inspectionPhotos: photos(body.inspection_photos, 2), actualCost, inspectionPassed: true, notes: optionalText(body.notes), actorId, changeReason: reason(body.change_reason) });
    if (result.error || !result.data) repositoryFailure(result.error, 'Penyelesaian perbaikan gagal disimpan.');
    return result.data;
  }

  async registerReplacement(body: Record<string, unknown>, actorId: string) {
    const replacementValue = body.replacement_value === undefined || body.replacement_value === null || body.replacement_value === '' ? undefined : Number(body.replacement_value);
    if (replacementValue !== undefined && (!Number.isFinite(replacementValue) || replacementValue <= 0)) throw new EquipmentRecoveryServiceError(422, 'INVALID_REPLACEMENT_VALUE', 'Nilai alat pengganti harus lebih besar dari 0.');
    const categoryCode = text(body.category, 'category', 30);
    const category = categoryMap[categoryCode];
    if (!category) throw new EquipmentRecoveryServiceError(422, 'INVALID_CATEGORY', 'Kategori alat pengganti tidak valid.');
    const result = await this.repository.registerReplacement({ caseId: id(body.case_id, 'case_id'), equipmentCode: text(body.equipment_code, 'equipment_code', 100), name: text(body.name, 'name', 200), category, storageLocation: optionalText(body.storage_location, 200), serialNumber: optionalText(body.serial_number, 120), photoUrls: photos(body.photo_urls, 3), description: optionalText(body.description), replacementValue, actorId, changeReason: reason(body.change_reason) });
    if (result.error || !result.data) repositoryFailure(result.error, 'Pendaftaran alat pengganti gagal disimpan.');
    return result.data;
  }

  async listCharges(query: { student_id?: string; status?: string }): Promise<EquipmentChargeSettlement[]> {
    const studentId = query.student_id ? id(query.student_id, 'student_id') : undefined;
    const status = query.status ? text(query.status, 'status', 20) : undefined;
    if (status && !chargeStatuses.has(status)) throw new EquipmentRecoveryServiceError(422, 'INVALID_STATUS', 'Status tagihan tidak valid.');
    const result = await this.repository.listCharges({ studentId, status: status as EquipmentChargeSettlement['status'] | undefined });
    if (result.error) repositoryFailure(result.error, 'Daftar tagihan alat gagal dimuat.');
    return result.data;
  }

  async recordChargePayment(body: Record<string, unknown>, actorId: string): Promise<EquipmentChargeSettlement> {
    const status = text(body.status, 'status', 20);
    if (!chargeStatuses.has(status)) throw new EquipmentRecoveryServiceError(422, 'INVALID_STATUS', 'Status pembayaran tidak valid.');
    const paidAmount = Number(body.paid_amount);
    if (!Number.isFinite(paidAmount) || paidAmount < 0) throw new EquipmentRecoveryServiceError(422, 'INVALID_AMOUNT', 'Jumlah pembayaran tidak valid.');
    if ((status === 'unpaid' && paidAmount !== 0) || (status === 'partial' && paidAmount <= 0) || (status === 'paid' && paidAmount <= 0)) throw new EquipmentRecoveryServiceError(422, 'INVALID_AMOUNT', 'Jumlah pembayaran tidak sesuai dengan status tagihan.');
    const result = await this.repository.recordChargePayment({ settlementId: id(body.settlement_id, 'settlement_id'), paidAmount, status: status as ChargePaymentInput['status'], notes: optionalText(body.notes), actorId, changeReason: reason(body.change_reason) });
    if (result.error || !result.data) repositoryFailure(result.error, 'Pembayaran tagihan gagal disimpan.');
    return result.data;
  }

  async reserveChargeEvidence(settlementId: string, body: Record<string, unknown>, actorId: string) {
    const normalizedSettlementId = id(settlementId, 'settlement_id');
    const evidenceType = text(body.evidence_type, 'evidence_type', 20) as EquipmentEvidenceType;
    if (!evidenceTypes.has(evidenceType)) throw new EquipmentRecoveryServiceError(422, 'CHARGE_EVIDENCE_INVALID', 'Jenis bukti tidak valid.');
    const fileName = text(body.file_name, 'file_name', 255);
    const contentType = text(body.content_type, 'content_type', 80).toLowerCase();
    const fileSizeBytes = Number(body.file_size_bytes);
    if (!evidenceMimeTypes.has(contentType) || !Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > maxEvidenceBytes) {
      throw new EquipmentRecoveryServiceError(422, 'CHARGE_EVIDENCE_FILE_INVALID', 'Foto harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 600 KB.');
    }
    let upload: ReturnType<typeof generateR2PrivateUploadUrl>;
    try { upload = generateR2PrivateUploadUrl(fileName, `equipment-charge-evidence/${normalizedSettlementId}/${evidenceType}`); }
    catch { throw new EquipmentRecoveryServiceError(503, 'CHARGE_EVIDENCE_STORAGE_UNAVAILABLE', 'Penyimpanan bukti sedang tidak tersedia.'); }
    const result = await this.repository.reserveChargeEvidence({ settlementId: normalizedSettlementId, evidenceType, objectKey: upload.key, mimeType: contentType, fileSizeBytes, originalFilename: fileName, actorId });
    if (result.error || !result.data) repositoryFailure(result.error, 'Gagal menyiapkan unggahan bukti.');
    return { evidence_id: result.data.id, upload_url: upload.uploadUrl, expires_in_seconds: upload.expiresInSeconds };
  }

  async recordChargePaymentEvent(body: Record<string, unknown>, actorId: string): Promise<EquipmentChargeSettlement> {
    const settlementId = id(body.settlement_id, 'settlement_id');
    const paymentAmount = Number(body.payment_amount);
    const roundedPaymentAmount = Number(paymentAmount.toFixed(2));
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > 9_999_999_999.99 || Math.abs(paymentAmount - roundedPaymentAmount) > 1e-9) throw new EquipmentRecoveryServiceError(422, 'CHARGE_AMOUNT_INVALID', 'Jumlah pembayaran harus lebih besar dari 0 dan maksimal 2 angka desimal.');
    const evidenceIds = Array.isArray(body.evidence_ids)
      ? body.evidence_ids.map((value) => {
          if (typeof value !== 'string') return '';
          return value.trim();
        })
      : [];
    if (evidenceIds.length === 0 || evidenceIds.some((value) => !evidenceIdPattern.test(value)) || new Set(evidenceIds).size !== evidenceIds.length) throw new EquipmentRecoveryServiceError(422, 'CHARGE_EVIDENCE_REQUIRED', 'Bukti pembayaran wajib diunggah.');
    const evidence = await Promise.all(evidenceIds.map((evidenceId) => this.repository.getChargeEvidence(evidenceId)));
    if (evidence.some((result) => result.error)) repositoryFailure(evidence.find((result) => result.error)?.error, 'Gagal memeriksa bukti pembayaran.');
    const records = evidence.map((result) => result.data);
    if (records.some((item) => !item || item.settlement_id !== settlementId || item.created_by !== actorId || item.upload_status !== 'pending')) throw new EquipmentRecoveryServiceError(422, 'CHARGE_EVIDENCE_INVALID', 'Bukti pembayaran tidak sesuai dengan tagihan ini.');
    if (!records.some((item) => item?.evidence_type === 'payment')) throw new EquipmentRecoveryServiceError(422, 'CHARGE_EVIDENCE_REQUIRED', 'Bukti pembayaran wajib diunggah.');
    if (this.repository.isConfigured()) {
      await Promise.all(records.map(async (item) => {
        if (!item) return;
        let object: Awaited<ReturnType<typeof inspectCloudflareR2Object>>;
        try { object = await inspectCloudflareR2Object(item.object_key); }
        catch { throw new EquipmentRecoveryServiceError(503, 'CHARGE_EVIDENCE_STORAGE_UNAVAILABLE', 'Bukti belum dapat diverifikasi dari penyimpanan.'); }
        if (!object.exists || (object.contentType && object.contentType.toLowerCase() !== item.mime_type.toLowerCase()) || (object.contentLength !== null && object.contentLength !== undefined && object.contentLength !== item.file_size_bytes)) throw new EquipmentRecoveryServiceError(422, 'CHARGE_EVIDENCE_UPLOAD_INCOMPLETE', 'Unggahan bukti belum selesai atau ukurannya berubah.');
      }));
    }
    const input: ChargePaymentEventInput = { settlementId, paymentAmount, evidenceIds, notes: optionalText(body.notes), actorId, changeReason: reason(body.change_reason) };
    const result = await this.repository.recordChargePaymentEvent(input);
    if (result.error || !result.data) repositoryFailure(result.error, 'Pembayaran tagihan gagal disimpan.');
    return result.data;
  }

  async getChargeEvidenceAccess(evidenceId: string) {
    const normalizedEvidenceId = id(evidenceId, 'evidence_id');
    if (!evidenceIdPattern.test(normalizedEvidenceId)) throw new EquipmentRecoveryServiceError(422, 'CHARGE_EVIDENCE_INVALID', 'Identitas bukti tagihan tidak valid.');
    const result = await this.repository.getChargeEvidence(normalizedEvidenceId);
    if (result.error) repositoryFailure(result.error, 'Gagal memuat bukti pembayaran.');
    if (!result.data || result.data.upload_status !== 'attached') throw new EquipmentRecoveryServiceError(404, 'CHARGE_EVIDENCE_NOT_FOUND', 'Bukti pembayaran tidak ditemukan.');
    try { const access = generateR2PrivateAccessUrl(result.data.object_key); return { access_url: access.accessUrl, expires_in_seconds: access.expiresInSeconds }; }
    catch { throw new EquipmentRecoveryServiceError(503, 'CHARGE_EVIDENCE_STORAGE_UNAVAILABLE', 'Bukti pembayaran sedang tidak dapat dibuka.'); }
  }

  async listChargeEvidenceAccess(settlementId: string) {
    const result = await this.repository.listChargeEvidence(id(settlementId, 'settlement_id'));
    if (result.error) repositoryFailure(result.error, 'Gagal memuat bukti tagihan.');
    try {
      return result.data.map((item) => {
        const access = generateR2PrivateAccessUrl(item.object_key);
        return { evidence_id: item.id, evidence_type: item.evidence_type, original_filename: item.original_filename, mime_type: item.mime_type, file_size_bytes: item.file_size_bytes, access_url: access.accessUrl, expires_in_seconds: access.expiresInSeconds, created_at: item.created_at };
      });
    } catch { throw new EquipmentRecoveryServiceError(503, 'CHARGE_EVIDENCE_STORAGE_UNAVAILABLE', 'Bukti tagihan sedang tidak dapat dibuka.'); }
  }
}
