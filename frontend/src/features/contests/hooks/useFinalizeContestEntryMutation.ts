import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../api/contests.service';
import type { FinalizeContestEntryPayload } from '../types/contests.types';

type FinalizeInput = {
  entryId: string;
  evidenceFile: File;
  payload: Omit<FinalizeContestEntryPayload, 'evidence_id'>;
};

export function useFinalizeContestEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, evidenceFile, payload }: FinalizeInput) => {
      const evidenceId = await contestsService.uploadContestEvidence(entryId, 'selesai', evidenceFile);
      return contestsService.finalizeContestEntry(entryId, { ...payload, evidence_id: evidenceId });
    },
    onSuccess: async ({ entry }) => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CONTEST_ENTRIES(entry.contest_id),
        QUERY_KEYS.CONTEST_ACHIEVEMENTS,
        QUERY_KEYS.CONTESTS,
        QUERY_KEYS.CONTEST_DETAIL(entry.contest_id),
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
