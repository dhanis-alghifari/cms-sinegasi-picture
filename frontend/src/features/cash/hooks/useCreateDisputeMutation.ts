
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { cashService } from '../api/cash.service';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  CashDisputeSummary,
  CashTransaction,
  CreateDisputePayload,
  DebtRecord,
} from '../types/cash.types';

export function useCreateDisputeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { suppressSuccessToast: true },
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateDisputePayload;
      idempotencyKey?: string;
    }) => cashService.createDispute(payload, idempotencyKey ?? crypto.randomUUID()),
    onSuccess: async (response, variables) => {
      const { dispute, quota } = response.data;
      const summary: CashDisputeSummary = {
        id: dispute.id,
        status: dispute.status,
        reason: dispute.reason,
        has_evidence: dispute.has_evidence,
        attempt_number: dispute.attempt_number,
        review_note: dispute.review_note,
      };
      const transactionId = dispute.transaction_id ?? variables.payload.transaction_id;
      const debtRecordId = dispute.debt_record_id ?? variables.payload.debt_record_id;

      if (transactionId) {
        queryClient.setQueriesData<PaginatedResponse<CashTransaction>>(
          { queryKey: QUERY_KEYS.CASH_TRANSACTIONS },
          (current) => current ? {
            ...current,
            data: current.data.map((transaction) => transaction.id === transactionId
              ? { ...transaction, dispute: summary }
              : transaction),
          } : current,
        );
      }

      if (debtRecordId) {
        queryClient.setQueriesData<PaginatedResponse<DebtRecord>>(
          { queryKey: QUERY_KEYS.CASH_DEBT_RECORDS },
          (current) => current ? {
            ...current,
            data: current.data.map((debt) => debt.id === debtRecordId
              ? { ...debt, dispute: summary }
              : debt),
          } : current,
        );
      }

      queryClient.setQueryData(QUERY_KEYS.CASH_DISPUTE_QUOTA, {
        success: true,
        data: quota,
      });

      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CASH_TRANSACTIONS,
        QUERY_KEYS.CASH_DEBT_RECORDS,
        QUERY_KEYS.CASH_DEBTS,
        QUERY_KEYS.CASH_DISPUTES,
        QUERY_KEYS.CASH_DISPUTE_QUOTA,
      ]);
    },
    onError: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CASH_TRANSACTIONS,
        QUERY_KEYS.CASH_DEBT_RECORDS,
        QUERY_KEYS.CASH_DISPUTES,
        QUERY_KEYS.CASH_DISPUTE_QUOTA,
      ]);
    },
  });
}
