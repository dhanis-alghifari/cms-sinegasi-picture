// src/features/cash/mutations/useUpdateBillingRulesMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { cashService } from '../services/cash.service';
import type { UpdateBillingRulePayload } from '../types/cash.types';

export function useUpdateBillingRulesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      changeReason,
    }: {
      payload: UpdateBillingRulePayload;
      changeReason: string;
    }) => cashService.updateBillingRules(payload, changeReason),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [QUERY_KEYS.BILLING_RULES]);
    },
  });
}
