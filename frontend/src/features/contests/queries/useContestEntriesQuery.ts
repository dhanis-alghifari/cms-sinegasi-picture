import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../services/contests.service';

export function useContestEntriesQuery(
  contestId: string | undefined,
  params?: { page?: number; pageSize?: number; status?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: contestId ? [...QUERY_KEYS.CONTEST_ENTRIES(contestId), params] : ['contests', 'entries', 'disabled'],
    queryFn: () => contestsService.getContestEntries(contestId as string, params),
    enabled: Boolean(contestId) && enabled,
  });
}
