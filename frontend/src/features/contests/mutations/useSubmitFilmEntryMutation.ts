// src/features/contests/mutations/useSubmitFilmEntryMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { contestsService } from '../services/contests.service';
import type { SubmitFilmEntryPayload } from '../types/contests.types';

export function useSubmitFilmEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: SubmitFilmEntryPayload;
    }) => contestsService.submitFilmEntry(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CONTESTS,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
