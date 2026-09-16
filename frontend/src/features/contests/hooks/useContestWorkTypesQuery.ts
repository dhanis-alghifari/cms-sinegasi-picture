import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { contestsService } from '../api/contests.service';
import { CONTEST_WORK_TYPE_OPTIONS } from '../utils/contestLabels';

export function useContestWorkTypesQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CONTEST_WORK_TYPES,
    queryFn: () => contestsService.getContestWorkTypes(),
    enabled,
    placeholderData: [...CONTEST_WORK_TYPE_OPTIONS],
    staleTime: UI_CONSTANTS.REFERENCE_DATA_STALE_TIME_MS,
  });
}
