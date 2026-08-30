import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../api/contests.service';
import type { RecordContestResultPayload } from '../types/contests.types';

export function useRecordContestResultMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, payload }: { entryId: string; payload: RecordContestResultPayload }) => contestsService.recordContestResult(entryId, payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [QUERY_KEYS.CONTEST_ACHIEVEMENTS, QUERY_KEYS.CONTESTS, QUERY_KEYS.DASHBOARD_SUMMARY]);
    },
  });
}
