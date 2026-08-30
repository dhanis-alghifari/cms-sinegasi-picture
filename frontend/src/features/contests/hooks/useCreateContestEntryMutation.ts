import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../api/contests.service';
import type { CreateContestEntryPayload } from '../types/contests.types';

export function useCreateContestEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, payload }: { contestId: string; payload: CreateContestEntryPayload }) =>
      contestsService.createContestEntry(contestId, payload),
    onSuccess: async (_, variables) => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CONTEST_ENTRIES(variables.contestId),
        QUERY_KEYS.CONTESTS,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
