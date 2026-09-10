// src/features/borrowing/api/borrowing.service.ts
// Pure TS borrowing & return transactions service

import { apiClient } from '@/shared/api/client';
import {
  decodeBorrowingList,
  decodeBorrowingRecord,
  decodeBorrowingSummary,
} from './borrowing.responses';
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
    return apiClient.getParsed(endpoint, decodeBorrowingList);
  },

  getSummary(): Promise<BorrowingSummary> {
    return apiClient.getParsed('/api/borrowing/summary', decodeBorrowingSummary);
  },

  createBorrowing(payload: CreateBorrowingPayload): Promise<BorrowingRecord> {
    const { idempotency_key, ...body } = payload;
    return apiClient.postParsed('/api/borrowing', body, decodeBorrowingRecord, idempotency_key ? {
      idempotencyKey: idempotency_key,
    } : undefined);
  },

  approveRejectBorrowing(
    payload: ApproveRejectPayload,
    changeReason: string,
  ): Promise<BorrowingRecord> {
    return apiClient.postParsed(`/api/borrowing/${payload.borrowing_id}/approve-reject`, payload, decodeBorrowingRecord, {
      changeReason,
    });
  },

  handoverBorrowing(id: string, changeReason: string): Promise<BorrowingRecord> {
    return apiClient.postParsed(`/api/borrowing/${id}/handover`, {}, decodeBorrowingRecord, {
      changeReason,
    });
  },

  processReturn(payload: ProcessReturnPayload, changeReason: string): Promise<BorrowingRecord> {
    return apiClient.postParsed(`/api/borrowing/${payload.borrowing_id}/return`, payload, decodeBorrowingRecord, {
      changeReason,
    });
  },
};
