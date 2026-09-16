import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { classesService } from '../api/classes.service';
import { UI_CONSTANTS } from '@/shared/constants/ui';

export function useClassOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CLASS_OPTIONS,
    queryFn: ({ signal }) => classesService.getOptions({ signal }),
    enabled,
    staleTime: UI_CONSTANTS.CLASS_OPTIONS_STALE_TIME_MS,
  });
}
