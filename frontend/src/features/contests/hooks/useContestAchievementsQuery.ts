import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../api/contests.service';
import type { ContestAchievementsParams } from '../types/contests.types';

export function useContestAchievementsQuery(params?: ContestAchievementsParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CONTEST_ACHIEVEMENTS, params],
    queryFn: () => contestsService.getContestAchievements(params),
    placeholderData: keepPreviousData,
  });
}

export function useContestAchievementDetailQuery(entryId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: entryId
      ? QUERY_KEYS.CONTEST_ACHIEVEMENT_DETAIL(entryId)
      : ['contest-achievements', 'detail', 'disabled'],
    queryFn: () => contestsService.getContestAchievementDetail(entryId as string),
    enabled: Boolean(entryId) && enabled,
    staleTime: 15_000,
  });
}

export function useContestEvidenceAccessQuery(evidenceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: evidenceId
      ? QUERY_KEYS.CONTEST_EVIDENCE_ACCESS(evidenceId)
      : ['contest-evidence', 'access', 'disabled'],
    queryFn: () => contestsService.getContestEvidenceAccess(evidenceId as string),
    enabled: Boolean(evidenceId) && enabled,
    staleTime: 60_000,
  });
}
