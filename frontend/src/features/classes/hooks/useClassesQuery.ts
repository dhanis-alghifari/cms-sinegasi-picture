import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { classesService } from '../api/classes.service';
import type { ClassFilterParams } from '../types/classes.types';

export function useClassesQuery(params?: ClassFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CLASSES, params],
    queryFn: () => classesService.getAdminClasses(params),
  });
}
