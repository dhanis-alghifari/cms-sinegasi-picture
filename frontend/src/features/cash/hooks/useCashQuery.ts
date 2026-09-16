
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { cashService } from '../api/cash.service';
import type { CashDebtFilters, CashReportFilters, CashTransactionFilters, DisputeStatus } from '../types/cash.types';

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
    staleTime: UI_CONSTANTS.CASH_PAYMENT_METHODS_STALE_TIME_MS,
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
  params?: CashDebtFilters,
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
    staleTime: UI_CONSTANTS.SHORT_QUERY_STALE_TIME_MS,
    enabled,
  });
}
