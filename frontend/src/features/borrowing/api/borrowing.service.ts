
import { apiClient } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';
import { compressImageFileToFile, MAX_COMPRESSED_IMAGE_BYTES, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
import {
  decodeBorrowingList,
  decodeBorrowingRecord,
  decodeBorrowingSummary,
  decodeReturnAssessmentPreview,
  decodeReturnEvidenceAccessList,
  decodeReturnEvidenceUploadReservation,
} from './borrowing.responses';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  BorrowingRecord,
  BorrowingSummary,
  BorrowingFilterParams,
  CreateBorrowingPayload,
  ApproveRejectPayload,
  ProcessReturnPayload,
  ReturnAssessmentPreview,
  ReturnEvidenceAccessRecord,
  ReturnEvidenceUploadReservation,
} from '../types/borrowing.types';

const borrowingStatusValues: Readonly<Record<string, string>> = {
  menunggu_persetujuan: 'pending_approval', disetujui: 'approved', ditolak: 'rejected', dipinjam: 'borrowed', dikembalikan: 'returned', terlambat: 'overdue',
};

const equipmentConditionValues: Readonly<Record<string, string>> = {
  bagus: 'good', sedikit_kerusakan: 'minor_damage', rusak: 'damaged', rusak_besar: 'severely_damaged', sedang_diperbaiki: 'under_repair', hilang: 'lost',
};

function toBorrowingRequest(payload: CreateBorrowingPayload) {
  const { tanggal_pinjam: borrow_date, rencana_kembali: planned_return_date, keperluan: purpose, ...rest } = payload;
  return { ...rest, borrow_date, planned_return_date, purpose };
}

function toApprovalRequest(payload: ApproveRejectPayload) {
  return { action: payload.action, ...(payload.catatan !== undefined ? { notes: payload.catatan } : {}) };
}

function toReturnRequest(payload: ProcessReturnPayload, includeEvidence = true) {
  const {
    tanggal_dikembalikan: return_date,
    catatan_pengembalian: return_notes,
    item_conditions,
  } = payload;
  return {
    return_date,
    item_conditions: item_conditions.map(({ kondisi_kembali: condition, evidence_ids, ...item }) => ({
      ...item,
      condition: equipmentConditionValues[condition],
      ...(includeEvidence && evidence_ids?.length ? { evidence_ids } : {}),
    })),
    ...(return_notes !== undefined ? { return_notes } : {}),
  };
}

export const borrowingService = {
  getBorrowings(params?: BorrowingFilterParams): Promise<PaginatedResponse<BorrowingRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', borrowingStatusValues[params.status]);
    if (params?.borrower_id) query.append('borrower_id', params.borrower_id);

    const endpoint = `/api/borrowing${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeBorrowingList);
  },

  getSummary(): Promise<BorrowingSummary> {
    return apiClient.getParsed('/api/borrowing/summary', decodeBorrowingSummary);
  },

  createBorrowing(payload: CreateBorrowingPayload): Promise<BorrowingRecord> {
    const { idempotency_key, ...body } = payload;
    return apiClient.postParsed('/api/borrowing', toBorrowingRequest(body), decodeBorrowingRecord, idempotency_key ? {
      idempotencyKey: idempotency_key,
    } : undefined);
  },

  approveRejectBorrowing(
    payload: ApproveRejectPayload,
    changeReason: string,
  ): Promise<BorrowingRecord> {
    return apiClient.postParsed(`/api/borrowing/${payload.borrowing_id}/approve-reject`, toApprovalRequest(payload), decodeBorrowingRecord, {
      changeReason,
    });
  },

  handoverBorrowing(id: string, changeReason: string): Promise<BorrowingRecord> {
    return apiClient.postParsed(`/api/borrowing/${id}/handover`, {}, decodeBorrowingRecord, {
      changeReason,
    });
  },

  processReturn(payload: ProcessReturnPayload, changeReason: string): Promise<BorrowingRecord> {
    return apiClient.postParsed(`/api/borrowing/${payload.borrowing_id}/return`, toReturnRequest(payload), decodeBorrowingRecord, {
      changeReason,
    });
  },

  previewReturn(payload: ProcessReturnPayload): Promise<ReturnAssessmentPreview> {
    return apiClient.postParsed(`/api/borrowing/${payload.borrowing_id}/return-assessment`, toReturnRequest(payload, false), decodeReturnAssessmentPreview);
  },

  listReturnEvidence(borrowingId: string): Promise<ReturnEvidenceAccessRecord[]> {
    return apiClient.getParsed(`/api/borrowing/${encodeURIComponent(borrowingId)}/return-evidence`, decodeReturnEvidenceAccessList);
  },

  async uploadReturnEvidence(borrowingId: string, equipmentId: string, file: File): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES) {
      throw new ApiError('Foto kondisi harus berupa JPG, PNG, atau WebP dengan ukuran sumber maksimal 5 MB.', 422, undefined, 'RETURN_EVIDENCE_FILE_INVALID');
    }
    const compressedFile = file.type === 'image/jpeg' && file.size <= MAX_COMPRESSED_IMAGE_BYTES
      ? file
      : await compressImageFileToFile(file);
    const reservation = await apiClient.postParsed<ReturnEvidenceUploadReservation>(
      `/api/borrowing/${borrowingId}/return-evidence-uploads`,
      {
        equipment_id: equipmentId,
        file_name: compressedFile.name,
        content_type: compressedFile.type,
        file_size_bytes: compressedFile.size,
      },
      decodeReturnEvidenceUploadReservation,
      { changeReason: 'Menyiapkan unggahan foto kondisi pengembalian' },
    );
    const uploadResponse = await fetch(reservation.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': compressedFile.type },
      body: compressedFile,
    });
    if (!uploadResponse.ok) {
      throw new ApiError('Unggahan foto kondisi gagal. Silakan coba lagi.', 502, undefined, 'RETURN_EVIDENCE_UPLOAD_FAILED');
    }
    return reservation.evidence_id;
  },
};
