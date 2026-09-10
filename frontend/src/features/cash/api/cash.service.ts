// src/features/cash/api/cash.service.ts
// Pure TS cash management service

import { apiClient } from '@/shared/api/client';
import {
  decodeBillingRules,
  decodeCashDebts,
  decodeCashIn,
  decodeCashOut,
  decodeCashPaymentMethods,
  decodeCashReport,
  decodeCashSummary,
  decodeCashTransactions,
  decodeCreateDispute,
  decodeDisputeEvidence,
  decodeDisputeQuota,
  decodeDisputes,
  decodeResolveDispute,
} from './cash.responses';
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
  CashDispute,
  CashDisputeListResponse,
  CashDisputeQuota,
  CreateDisputeResponse,
} from '../types/cash.types';

export const cashService = {
  getSummary(): Promise<CashSummary> {
    return apiClient.getParsed('/api/cash/summary', decodeCashSummary);
  },

  getReport(params: CashReportFilters): Promise<CashReport> {
    const query = new URLSearchParams({
      start_date: params.start_date,
      end_date: params.end_date,
    });
    if (params.metode_pembayaran) query.set('metode_pembayaran', params.metode_pembayaran);
    return apiClient.getParsed(`/api/cash/report?${query.toString()}`, decodeCashReport);
  },

  getPaymentMethods(): Promise<{ success: boolean; data: CashPaymentMethod[] }> {
    return apiClient.getParsed('/api/cash/payment-methods', decodeCashPaymentMethods);
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
    return apiClient.getParsed(endpoint, decodeCashTransactions);
  },

  getDebts(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResponse<DebtRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);

    const endpoint = `/api/cash/debts${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeCashDebts);
  },

  getBillingRules(): Promise<BillingRule> {
    return apiClient.getParsed('/api/cash/billing-rules', decodeBillingRules);
  },

  // Fast-entry Cash In
  createCashIn(payload: CreateCashInPayload, idempotencyKey: string): Promise<CashInApiResponse> {
    return apiClient.postParsed('/api/cash/transactions/in', payload, decodeCashIn, {
      headers: { 'x-idempotency-key': idempotencyKey },
      changeReason: 'Pencatatan transaksi kas masuk',
    });
  },

  // Two-Stage Cash Out (checks balance on server side + validates rincian)
  createCashOut(payload: CreateCashOutPayload, idempotencyKey: string): Promise<CashTransaction> {
    return apiClient.postParsed('/api/cash/transactions/out', payload, decodeCashOut, {
      headers: { 'x-idempotency-key': idempotencyKey },
      changeReason: 'Pencatatan transaksi kas keluar',
    });
  },

  // Student Dispute with Mandatory Proof Photo
  createDispute(payload: CreateDisputePayload, idempotencyKey: string): Promise<CreateDisputeResponse> {
    return apiClient.postParsed('/api/cash/disputes', payload, decodeCreateDispute, {
      idempotencyKey,
      changeReason: 'Pengajuan sanggahan kas',
    });
  },

  getDisputeQuota(): Promise<{ success: boolean; data: CashDisputeQuota }> {
    return apiClient.getParsed('/api/cash/disputes/quota', decodeDisputeQuota);
  },

  getDisputeEvidence(disputeId: string): Promise<{ success: boolean; data: { url: string } }> {
    return apiClient.getParsed(`/api/cash/disputes/${disputeId}/evidence`, decodeDisputeEvidence);
  },

  getDisputes(params?: { page?: number; pageSize?: number; status?: DisputeStatus; cursor?: string; limit?: number }): Promise<{ success: boolean } & CashDisputeListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status === 'resolved' ? 'approved' : params.status);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiClient.getParsed(`/api/cash/disputes${suffix}`, decodeDisputes);
  },

  // Resolve/Reject Dispute (Treasurer/Teacher)
  resolveDispute(disputeId: string, input: { status: DisputeStatus; review_note: string; resolution_date?: string; resolution_amount?: number; payment_method_code?: string }, changeReason: string): Promise<{ success: boolean; data: { dispute: CashDispute; resolutionTransactionId?: string; idempotentReplay: boolean } }> {
    return apiClient.patchParsed(`/api/cash/disputes/${disputeId}`, { ...input, status: input.status === 'resolved' ? 'approved' : input.status }, decodeResolveDispute, {
      changeReason,
    });
  },

  // Update Global Billing Rules
  updateBillingRules(payload: UpdateBillingRulePayload, changeReason: string): Promise<BillingRule> {
    return apiClient.putParsed('/api/cash/billing-rules', payload, decodeBillingRules, {
      changeReason,
    });
  },
};
