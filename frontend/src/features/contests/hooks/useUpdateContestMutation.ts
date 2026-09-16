
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { contestsService } from '../api/contests.service';
import type { UpdateContestPayload } from '../types/contests.types';

export function useUpdateContestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      changeReason,
    }: {
      id: string;
      payload: UpdateContestPayload;
      changeReason: string;
    }) => contestsService.updateContest(id, payload, changeReason),
    onSuccess: async (_, variables) => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CONTESTS,
        QUERY_KEYS.CONTEST_DETAIL(variables.id),
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
