import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../api/contests.service';
import type { ContestAchievementsParams } from '../types/contests.types';

export function useContestAchievementsQuery(params?: ContestAchievementsParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CONTEST_ACHIEVEMENTS, params],
    queryFn: () => contestsService.getContestAchievements(params),
  });
}
