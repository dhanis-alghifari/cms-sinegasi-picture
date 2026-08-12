// src/features/cash/services/cash.service.ts
// Pure TS cash management service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  CashTransaction,
  DebtRecord,
  BillingRule,
  CashSummary,
  CreateCashInPayload,
  CreateCashOutPayload,
  CreateDisputePayload,
  UpdateBillingRulePayload,
  DisputeStatus,
  CashTransactionFilters,
  CashReport,
  CashReportFilters,
  CashPaymentMethod,
  CashInApiResponse,
} from '../types/cash.types';

export const cashService = {
  getSummary(): Promise<CashSummary> {
    return apiClient.get<CashSummary>('/api/cash/summary');
  },

  getReport(params: CashReportFilters): Promise<CashReport> {
    const query = new URLSearchParams({
      start_date: params.start_date,
      end_date: params.end_date,
    });
    if (params.metode_pembayaran) query.set('metode_pembayaran', params.metode_pembayaran);
    return apiClient.get<CashReport>(`/api/cash/report?${query.toString()}`);
  },

  getPaymentMethods(): Promise<{ success: boolean; data: CashPaymentMethod[] }> {
    return apiClient.get<{ success: boolean; data: CashPaymentMethod[] }>('/api/cash/payment-methods');
  },

  getTransactions(params?: CashTransactionFilters): Promise<PaginatedResponse<CashTransaction>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.tipe) query.append('tipe', params.tipe);
    if (params?.tanggal_mulai) query.append('tanggal_mulai', params.tanggal_mulai);
    if (params?.tanggal_selesai) {
      const end = new Date(`${params.tanggal_selesai}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      query.append('tanggal_selesai', end.toISOString().slice(0, 10));
    }
    if (params?.metode_pembayaran) query.append('metode_pembayaran', params.metode_pembayaran);

    const endpoint = `/api/cash/transactions${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<CashTransaction>>(endpoint);
  },

  getDebts(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResponse<DebtRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);

    const endpoint = `/api/cash/debts${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<DebtRecord>>(endpoint);
  },

  getBillingRules(): Promise<BillingRule> {
    return apiClient.get<BillingRule>('/api/cash/billing-rules');
  },

  // Fast-entry Cash In
  createCashIn(payload: CreateCashInPayload, idempotencyKey: string): Promise<CashInApiResponse> {
    return apiClient.post<CashInApiResponse>('/api/cash/transactions/in', payload, {
      headers: { 'x-idempotency-key': idempotencyKey },
      changeReason: 'Pencatatan transaksi kas masuk',
    });
  },

  // Two-Stage Cash Out (checks balance on server side + validates rincian)
  createCashOut(payload: CreateCashOutPayload, idempotencyKey: string): Promise<CashTransaction> {
    return apiClient.post<CashTransaction>('/api/cash/transactions/out', payload, {
      headers: { 'x-idempotency-key': idempotencyKey },
      changeReason: 'Pencatatan transaksi kas keluar',
    });
  },

  // Student Dispute with Mandatory Proof Photo
  createDispute(payload: CreateDisputePayload): Promise<void> {
    return apiClient.post<void>('/api/cash/disputes', payload);
  },

  // Resolve/Reject Dispute (Treasurer/Teacher)
  resolveDispute(disputeId: string, status: DisputeStatus, changeReason: string): Promise<void> {
    return apiClient.patch<void>(`/api/cash/disputes/${disputeId}`, { status }, {
      changeReason,
    });
  },

  // Update Global Billing Rules
  updateBillingRules(payload: UpdateBillingRulePayload, changeReason: string): Promise<BillingRule> {
    return apiClient.put<BillingRule>('/api/cash/billing-rules', payload, {
      changeReason,
    });
  },
};
