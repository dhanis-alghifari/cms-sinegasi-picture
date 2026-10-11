
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { contestsService } from '../api/contests.service';
import type { CreateContestPayload } from '../types/contests.types';

export function useCreateContestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Event festival berhasil ditambahkan.' },
    mutationFn: ({
      payload,
    }: {
      payload: CreateContestPayload;
    }) => contestsService.createContest(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CONTESTS,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
