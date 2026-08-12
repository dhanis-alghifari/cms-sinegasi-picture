// src/features/cash/mutations/useCreateDisputeMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { cashService } from '../services/cash.service';
import type { CreateDisputePayload } from '../types/cash.types';

export function useCreateDisputeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: CreateDisputePayload;
    }) => cashService.createDispute(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CASH_TRANSACTIONS,
        QUERY_KEYS.CASH_DISPUTES,
      ]);
    },
  });
}
