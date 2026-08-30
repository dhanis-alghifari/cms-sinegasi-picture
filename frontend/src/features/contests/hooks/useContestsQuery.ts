// src/features/contests/hooks/useContestsQuery.ts
// TanStack Query hooks for contests domain

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../api/contests.service';
import type { ContestFilterParams } from '../types/contests.types';

export function useContestsQuery(params?: ContestFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CONTESTS, params],
    queryFn: () => contestsService.getContests(params),
  });
}

export function useContestSummaryQuery() {
  return useQuery({
    queryKey: ['contests', 'summary'],
    queryFn: () => contestsService.getSummary(),
  });
}
