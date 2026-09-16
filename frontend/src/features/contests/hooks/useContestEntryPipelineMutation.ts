import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import {
  updateContestEntryPipeline,
  type ContestEntryPipelineUpdate,
  type ContestEntryPipelineUpdateResult,
} from '../api/contestEntryPipeline.service';

function getPipelineQueryKeys(
  result: ContestEntryPipelineUpdateResult,
) {
  const queryKeys: QueryKey[] = [
    QUERY_KEYS.CONTEST_ENTRIES(result.entry.contest_id),
    QUERY_KEYS.CONTESTS,
    QUERY_KEYS.CONTEST_DETAIL(result.entry.contest_id),
    QUERY_KEYS.DASHBOARD_SUMMARY,
  ];

  if (result.refreshAchievements) {
    queryKeys.push(QUERY_KEYS.CONTEST_ACHIEVEMENTS);
  }

  return queryKeys;
}

export function useContestEntryPipelineMutation() {
  const queryClient = useQueryClient();

  return useMutation<ContestEntryPipelineUpdateResult, Error, ContestEntryPipelineUpdate>({
    mutationFn: updateContestEntryPipeline,
    onSuccess: async (result) => {
      await invalidateActiveQueries(queryClient, getPipelineQueryKeys(result));
    },
  });
}
