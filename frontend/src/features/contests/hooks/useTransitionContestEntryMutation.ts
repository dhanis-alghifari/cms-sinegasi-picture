import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../api/contests.service';
import type { TransitionContestEntryPayload } from '../types/contests.types';

export function useTransitionContestEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, payload, evidenceFile }: { entryId: string; payload: TransitionContestEntryPayload; evidenceFile?: File }) => {
      const evidenceId = evidenceFile
        ? await contestsService.uploadContestEvidence(entryId, 'sudah_terkirim', evidenceFile)
        : payload.evidence_id;
      return contestsService.transitionContestEntry(entryId, { ...payload, evidence_id: evidenceId });
    },
    onSuccess: async (entry) => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CONTEST_ENTRIES(entry.contest_id),
        QUERY_KEYS.CONTESTS,
        QUERY_KEYS.CONTEST_DETAIL(entry.contest_id),
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
