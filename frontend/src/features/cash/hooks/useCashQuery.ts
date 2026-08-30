// src/features/cash/hooks/useCashQuery.ts
// TanStack Query hooks for cash domain

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { cashService } from '../api/cash.service';
import type { CashReportFilters, CashTransactionFilters, DisputeStatus } from '../types/cash.types';

export function useCashSummaryQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.CASH_BALANCE,
    queryFn: () => cashService.getSummary(),
  });
}

export function useCashPaymentMethodsQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CASH_PAYMENT_METHODS,
    queryFn: () => cashService.getPaymentMethods(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useCashTransactionsQuery(params?: CashTransactionFilters, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CASH_TRANSACTIONS, params],
    queryFn: () => cashService.getTransactions(params),
    enabled,
  });
}

export function useCashReportQuery(params: CashReportFilters, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CASH_REPORT, params],
    queryFn: () => cashService.getReport(params),
    enabled,
  });
}

export function useCashDebtsQuery(
  params?: { page?: number; pageSize?: number; search?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CASH_DEBT_RECORDS, params],
    queryFn: () => cashService.getDebts(params),
    enabled,
  });
}

export function useBillingRulesQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.BILLING_RULES,
    queryFn: () => cashService.getBillingRules(),
    enabled,
  });
}

export function useCashDisputesQuery(params?: { page?: number; pageSize?: number; status?: DisputeStatus }, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CASH_DISPUTES, params],
    queryFn: () => cashService.getDisputes(params),
    enabled,
  });
}

export function useCashDisputeQuotaQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CASH_DISPUTE_QUOTA,
    queryFn: () => cashService.getDisputeQuota(),
    staleTime: 30_000,
    enabled,
  });
}
