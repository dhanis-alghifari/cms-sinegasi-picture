
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
  CashDebtFilters,
  CashReportFilters,
  CashPaymentMethod,
  CashInApiResponse,
  CashDispute,
  CashDisputeListResponse,
  CashDisputeQuota,
  CreateDisputeResponse,
  CashScope,
} from '../types/cash.types';

const transactionTypeValues: Readonly<Record<string, string>> = {
  masuk: 'income', keluar: 'expense',
};

const cashInTypeValues: Readonly<Record<string, string>> = {
  iuran_wajib: 'mandatory_fee', pemasukan: 'other_income',
};

function toCashInRequest(payload: CreateCashInPayload) {
  const {
    jumlah: amount,
    tanggal: date,
    keterangan: description,
    foto_bukti_url: proof_photo_url,
    metode_pembayaran: payment_method,
    type,
    ...rest
  } = payload;
  return {
    ...rest,
    amount,
    date,
    ...(description !== undefined ? { description } : {}),
    ...(proof_photo_url !== undefined ? { proof_photo_url } : {}),
    ...(payment_method !== undefined ? { payment_method } : {}),
    ...(type !== undefined ? { type: cashInTypeValues[type] } : {}),
  };
}

function toCashOutRequest(payload: CreateCashOutPayload) {
  const {
    jumlah: amount,
    keterangan: description,
    foto_bukti_url: proof_photo_url,
    metode_pembayaran: payment_method,
    ...rest
  } = payload;
  return {
    ...rest,
    amount,
    description,
    ...(proof_photo_url !== undefined ? { proof_photo_url } : {}),
    ...(payment_method !== undefined ? { payment_method } : {}),
  };
}

function toDisputeRequest(payload: CreateDisputePayload) {
  const { bukti_sanggahan_url: evidence_url, ...rest } = payload;
  return { ...rest, evidence_url };
}

function toBillingRuleRequest(payload: UpdateBillingRulePayload) {
  const { nominal_iuran_wajib: mandatory_fee_amount, ...rest } = payload;
  return { ...rest, mandatory_fee_amount };
}

export const cashService = {
  getSummary(scope: CashScope = 'manage'): Promise<CashSummary> {
    return apiClient.getParsed(`/api/cash/summary?scope=${scope}`, decodeCashSummary);
  },

  getReport(params: CashReportFilters): Promise<CashReport> {
    const query = new URLSearchParams({
      start_date: params.start_date,
      end_date: params.end_date,
    });
    if (params.metode_pembayaran) query.set('payment_method', params.metode_pembayaran);
    return apiClient.getParsed(`/api/cash/report?${query.toString()}`, decodeCashReport);
  },

  getPaymentMethods(): Promise<{ success: boolean; data: CashPaymentMethod[] }> {
    return apiClient.getParsed('/api/cash/payment-methods', decodeCashPaymentMethods);
  },

  getTransactions(params?: CashTransactionFilters): Promise<PaginatedResponse<CashTransaction>> {
    const query = new URLSearchParams();
    if (params?.scope) query.append('scope', params.scope);
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.tipe) query.append('type', transactionTypeValues[params.tipe]);
    if (params?.student_id) query.append('student_id', params.student_id);
    if (params?.tanggal_mulai) query.append('start_date', params.tanggal_mulai);
    if (params?.tanggal_selesai) {
      const end = new Date(`${params.tanggal_selesai}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      query.append('end_date', end.toISOString().slice(0, 10));
    }
    if (params?.metode_pembayaran) query.append('payment_method', params.metode_pembayaran);

    const endpoint = `/api/cash/transactions${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeCashTransactions);
  },

  getDebts(params?: CashDebtFilters): Promise<PaginatedResponse<DebtRecord>> {
    const query = new URLSearchParams();
    if (params?.scope) query.append('scope', params.scope);
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.student_id) query.append('student_id', params.student_id);

    const endpoint = `/api/cash/debts${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeCashDebts);
  },

  getBillingRules(): Promise<BillingRule> {
    return apiClient.getParsed('/api/cash/billing-rules', decodeBillingRules);
  },

  // Fast cash-in entry
  createCashIn(payload: CreateCashInPayload, idempotencyKey: string): Promise<CashInApiResponse> {
    return apiClient.postParsed('/api/cash/transactions/in', toCashInRequest(payload), decodeCashIn, {
      headers: { 'x-idempotency-key': idempotencyKey },
      changeReason: 'Pencatatan transaksi kas masuk',
    });
  },

  // Two-stage cash-out entry
  createCashOut(payload: CreateCashOutPayload, idempotencyKey: string): Promise<CashTransaction> {
    return apiClient.postParsed('/api/cash/transactions/out', toCashOutRequest(payload), decodeCashOut, {
      headers: { 'x-idempotency-key': idempotencyKey },
      changeReason: 'Pencatatan transaksi kas keluar',
    });
  },

  // Student dispute with mandatory proof photo
  createDispute(payload: CreateDisputePayload, idempotencyKey: string): Promise<CreateDisputeResponse> {
    return apiClient.postParsed('/api/cash/disputes', toDisputeRequest(payload), decodeCreateDispute, {
      idempotencyKey,
      changeReason: 'Pengajuan sanggahan kas',
    });
  },

  getDisputeQuota(): Promise<{ success: boolean; data: CashDisputeQuota }> {
    return apiClient.getParsed('/api/cash/disputes/quota', decodeDisputeQuota);
  },

  getDisputeEvidence(disputeId: string, scope: CashScope = 'own'): Promise<{ success: boolean; data: { url: string } }> {
    return apiClient.getParsed(`/api/cash/disputes/${disputeId}/evidence?scope=${scope}`, decodeDisputeEvidence);
  },

  getDisputes(params?: { scope?: CashScope; page?: number; pageSize?: number; status?: DisputeStatus; cursor?: string; limit?: number }): Promise<{ success: boolean } & CashDisputeListResponse> {
    const query = new URLSearchParams();
    if (params?.scope) query.set('scope', params.scope);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status === 'resolved' ? 'approved' : params.status);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiClient.getParsed(`/api/cash/disputes${suffix}`, decodeDisputes);
  },

  // Resolve or reject a dispute
  resolveDispute(disputeId: string, input: { status: DisputeStatus; review_note: string; resolution_date?: string; payment_method_code?: string }, changeReason: string): Promise<{ success: boolean; data: { dispute: CashDispute; resolutionTransactionId?: string; idempotentReplay: boolean } }> {
    return apiClient.patchParsed(`/api/cash/disputes/${disputeId}`, { ...input, status: input.status === 'resolved' ? 'approved' : input.status }, decodeResolveDispute, {
      changeReason,
    });
  },

  // Update global billing rules
  updateBillingRules(payload: UpdateBillingRulePayload, changeReason: string): Promise<BillingRule> {
    return apiClient.putParsed('/api/cash/billing-rules', toBillingRuleRequest(payload), decodeBillingRules, {
      changeReason,
    });
  },
};
