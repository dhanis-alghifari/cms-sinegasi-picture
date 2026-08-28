import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { classesService } from '../services/classes.service';

export function useClassOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CLASS_OPTIONS,
    queryFn: () => classesService.getOptions(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
