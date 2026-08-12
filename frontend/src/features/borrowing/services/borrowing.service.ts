// src/features/borrowing/services/borrowing.service.ts
// Pure TS borrowing & return transactions service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  BorrowingRecord,
  BorrowingSummary,
  BorrowingFilterParams,
  CreateBorrowingPayload,
  ApproveRejectPayload,
  ProcessReturnPayload,
} from '../types/borrowing.types';

export const borrowingService = {
  getBorrowings(params?: BorrowingFilterParams): Promise<PaginatedResponse<BorrowingRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.borrower_id) query.append('borrower_id', params.borrower_id);

    const endpoint = `/api/borrowing${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<BorrowingRecord>>(endpoint);
  },

  getSummary(): Promise<BorrowingSummary> {
    return apiClient.get<BorrowingSummary>('/api/borrowing/summary');
  },

  createBorrowing(payload: CreateBorrowingPayload): Promise<BorrowingRecord> {
    const { idempotency_key, ...body } = payload;
    return apiClient.post<BorrowingRecord>('/api/borrowing', body, idempotency_key ? {
      headers: { 'x-idempotency-key': idempotency_key },
    } : undefined);
  },

  approveRejectBorrowing(
    payload: ApproveRejectPayload,
    changeReason: string,
  ): Promise<BorrowingRecord> {
    return apiClient.post<BorrowingRecord>(`/api/borrowing/${payload.borrowing_id}/approve-reject`, payload, {
      changeReason,
    });
  },

  handoverBorrowing(id: string, changeReason: string): Promise<BorrowingRecord> {
    return apiClient.post<BorrowingRecord>(`/api/borrowing/${id}/handover`, {}, {
      changeReason,
    });
  },

  processReturn(payload: ProcessReturnPayload, changeReason: string): Promise<BorrowingRecord> {
    return apiClient.post<BorrowingRecord>(`/api/borrowing/${payload.borrowing_id}/return`, payload, {
      changeReason,
    });
  },
};
