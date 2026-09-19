
import { apiClient } from '@/shared/api/client';
import { compressImageFileToFile, MAX_COMPRESSED_IMAGE_BYTES, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
import {
  decodeEquipment,
  decodeEquipmentList,
  decodeEquipmentSummary,
  decodeEquipmentValuation,
  decodeEquipmentValuations,
  decodeEquipmentReport,
  decodeEquipmentEnvelope,
  decodeEquipmentRecoveryCases,
  decodeEquipmentRecoveryCase,
  decodeEquipmentCharges,
  decodeEquipmentCharge,
  decodeEquipmentEvidenceUploadReservation,
  decodeEquipmentEvidenceAccessList,
} from './equipment.responses';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  Equipment,
  EquipmentSummary,
  EquipmentFilterParams,
  CreateEquipmentPayload,
  UpdateEquipmentPayload,
  UpdateConditionPayload,
  EquipmentValuation,
  CreateEquipmentValuationPayload,
  EquipmentReport,
  EquipmentReportParams,
  EquipmentRecoveryCase,
  EquipmentChargeSettlement,
  EquipmentEvidenceType,
  EquipmentEvidenceUploadReservation,
  RecoveryType,
} from '../types/equipment.types';

const categoryValues: Readonly<Record<string, string>> = {
  Kamera: 'camera', Lensa: 'lens', Audio: 'audio', Lighting: 'lighting', Aksesoris: 'accessory', Lainnya: 'other',
};

const conditionValues: Readonly<Record<string, string>> = {
  bagus: 'good', sedikit_kerusakan: 'minor_damage', rusak: 'damaged', rusak_besar: 'severely_damaged', sedang_diperbaiki: 'under_repair', hilang: 'lost',
};

const availabilityValues: Readonly<Record<string, string>> = {
  tersedia: 'available', dipinjam: 'borrowed', maintenance: 'maintenance',
};

function toEquipmentRequest(payload: CreateEquipmentPayload | UpdateEquipmentPayload | UpdateConditionPayload) {
  const legacyPayload = payload as Partial<CreateEquipmentPayload> & UpdateConditionPayload;
  const {
    kode_alat: equipment_code,
    nama_alat: name,
    kategori,
    kondisi,
    lokasi_penyimpanan: storage_location,
    foto_urls: photo_urls,
    foto_url: photo_url,
    deskripsi: description,
    catatan_kerusakan: damage_notes,
    status,
    ...rest
  } = legacyPayload;
  return {
    ...rest,
    ...(equipment_code !== undefined ? { equipment_code } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(kategori !== undefined ? { category: categoryValues[kategori] } : {}),
    ...(kondisi !== undefined ? { condition: conditionValues[kondisi] } : {}),
    ...(status !== undefined ? { status: availabilityValues[status] } : {}),
    ...(storage_location !== undefined ? { storage_location } : {}),
    ...(photo_urls !== undefined ? { photo_urls } : {}),
    ...(photo_url !== undefined ? { photo_url } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(damage_notes !== undefined ? { damage_notes } : {}),
  };
}

export const equipmentService = {
  getEquipment(params?: EquipmentFilterParams): Promise<PaginatedResponse<Equipment>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.purpose) query.append('purpose', params.purpose);
    if (params?.search) query.append('search', params.search);
    if (params?.kategori) query.append('category', categoryValues[params.kategori]);
    if (params?.kondisi) query.append('condition', conditionValues[params.kondisi]);
    if (params?.status) query.append('status', availabilityValues[params.status]);

    const endpoint = `/api/equipment${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeEquipmentList);
  },

  getSummary(): Promise<EquipmentSummary> {
    return apiClient.getParsed('/api/equipment/summary', decodeEquipmentSummary);
  },

  getEquipmentById(id: string): Promise<Equipment> {
    return apiClient.getParsed(`/api/equipment/${id}`, decodeEquipment);
  },

  createEquipment(payload: CreateEquipmentPayload): Promise<Equipment> {
    return apiClient.postParsed('/api/equipment', toEquipmentRequest(payload), decodeEquipment);
  },

  updateEquipment(
    id: string,
    payload: UpdateEquipmentPayload,
    changeReason: string,
  ): Promise<Equipment> {
    return apiClient.putParsed(`/api/equipment/${id}`, toEquipmentRequest(payload), decodeEquipment, {
      changeReason,
    });
  },

  updateCondition(
    id: string,
    payload: UpdateConditionPayload,
    changeReason: string,
  ): Promise<Equipment> {
    return apiClient.patchParsed(`/api/equipment/${id}/condition`, toEquipmentRequest(payload), decodeEquipment, {
      changeReason,
    });
  },

  getReport(params: EquipmentReportParams): Promise<EquipmentReport> {
    const query = new URLSearchParams();
    if (params.scope) query.set('scope', params.scope);
    if (params.search) query.set('search', params.search);
    if (params.kategori) query.set('category', categoryValues[params.kategori]);
    if (params.kondisi) query.set('condition', conditionValues[params.kondisi]);
    if (params.status) query.set('status', availabilityValues[params.status]);
    if (params.includeValuation) query.set('include_valuation', 'true');
    if (params.includePhotos) query.set('include_photos', 'true');
    return apiClient.getParsed(`/api/equipment/report?${query.toString()}`, decodeEquipmentReport);
  },

  getEquipmentValuations(id: string): Promise<EquipmentValuation[]> {
    return apiClient.getParsed(`/api/equipment/${id}/valuations`, decodeEquipmentValuations);
  },

  createEquipmentValuation(id: string, payload: CreateEquipmentValuationPayload, changeReason: string): Promise<EquipmentValuation> {
    return apiClient.postParsed(`/api/equipment/${id}/valuations`, payload, decodeEquipmentValuation, { changeReason });
  },

  getRecoveryCases(params?: { equipmentId?: string; status?: string }): Promise<EquipmentRecoveryCase[]> {
    const query = new URLSearchParams();
    if (params?.equipmentId) query.set('equipment_id', params.equipmentId);
    if (params?.status) query.set('status', params.status);
    return apiClient.getParsed(`/api/equipment/recovery-cases${query.toString() ? `?${query.toString()}` : ''}`, decodeEquipmentRecoveryCases);
  },

  createRecoveryCase(equipmentId: string, payload: { recovery_type: RecoveryType; reported_condition: string; notes?: string; change_reason: string }): Promise<EquipmentRecoveryCase> {
    return apiClient.postParsed(`/api/equipment/${equipmentId}/recovery-cases`, payload, decodeEquipmentRecoveryCase, { changeReason: payload.change_reason });
  },

  completeRecoveryRepair(payload: { case_id: string; inspection_photos: string[]; inspection_passed: boolean; actual_cost?: number; notes?: string; change_reason: string }): Promise<Equipment> {
    return apiClient.postParsed(`/api/equipment/recovery-cases/${payload.case_id}/complete-repair`, payload, decodeEquipmentEnvelope, { changeReason: payload.change_reason });
  },

  registerRecoveryReplacement(payload: { case_id: string; equipment_code: string; name: string; category: string; storage_location?: string; serial_number?: string; photo_urls: string[]; description?: string; replacement_value?: number; change_reason: string }): Promise<Equipment> {
    return apiClient.postParsed(`/api/equipment/recovery-cases/${payload.case_id}/register-replacement`, payload, decodeEquipmentEnvelope, { changeReason: payload.change_reason });
  },

  getEquipmentCharges(params?: { studentId?: string; status?: string }): Promise<EquipmentChargeSettlement[]> {
    const query = new URLSearchParams(); if (params?.studentId) query.set('student_id', params.studentId); if (params?.status) query.set('status', params.status);
    return apiClient.getParsed(`/api/equipment/charges${query.toString() ? `?${query.toString()}` : ''}`, decodeEquipmentCharges);
  },

  recordEquipmentChargePayment(payload: { settlement_id: string; paid_amount: number; status: EquipmentChargeSettlement['status']; notes?: string; change_reason: string }): Promise<EquipmentChargeSettlement> {
    return apiClient.patchParsed(`/api/equipment/charges/${payload.settlement_id}`, payload, decodeEquipmentCharge, { changeReason: payload.change_reason });
  },

  async uploadEquipmentChargeEvidence(settlementId: string, evidenceType: EquipmentEvidenceType, file: File): Promise<string> {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type) || file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error('Foto harus berupa JPG, PNG, atau WebP dengan ukuran sumber maksimal 5 MB.');
    }
    const compressedFile = file.type === 'image/jpeg' && file.size <= MAX_COMPRESSED_IMAGE_BYTES
      ? file
      : await compressImageFileToFile(file);
    if (compressedFile.size > MAX_COMPRESSED_IMAGE_BYTES) throw new Error('Foto terlalu besar untuk disimpan. Pilih foto lain.');
    const reservation = await apiClient.postParsed<EquipmentEvidenceUploadReservation>(
      `/api/equipment/charges/${encodeURIComponent(settlementId)}/evidence-uploads`,
      { evidence_type: evidenceType, file_name: compressedFile.name, content_type: compressedFile.type, file_size_bytes: compressedFile.size },
      decodeEquipmentEvidenceUploadReservation,
      { changeReason: 'Menyiapkan unggahan bukti tagihan alat' },
    );
    const uploadResponse = await fetch(reservation.upload_url, { method: 'PUT', headers: { 'Content-Type': compressedFile.type }, body: compressedFile });
    if (!uploadResponse.ok) throw new Error('Unggahan bukti gagal. Silakan coba lagi.');
    return reservation.evidence_id;
  },

  recordEquipmentChargePaymentEvent(payload: { settlement_id: string; payment_amount: number; evidence_ids: string[]; notes?: string; change_reason: string }): Promise<EquipmentChargeSettlement> {
    const requestId = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return apiClient.postParsed(`/api/equipment/charges/${payload.settlement_id}/payments`, payload, decodeEquipmentCharge, {
      changeReason: payload.change_reason,
      idempotencyKey: `equipment-payment-${requestId}`,
    });
  },

  listEquipmentChargeEvidence(settlementId: string) {
    return apiClient.getParsed(`/api/equipment/charges/${encodeURIComponent(settlementId)}/evidence`, decodeEquipmentEvidenceAccessList);
  },
};
