
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { cashService } from '../api/cash.service';
import type { CreateCashOutPayload } from '../types/cash.types';

export function useCreateCashOutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateCashOutPayload;
      idempotencyKey: string;
    }) => cashService.createCashOut(payload, idempotencyKey),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CASH_TRANSACTIONS,
        QUERY_KEYS.CASH_BALANCE,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
