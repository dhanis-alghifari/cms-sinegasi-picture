import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { studentsService } from '../services/students.service';

export function useStudentOptionsQuery(search: string, enabled = true) {
  const debouncedSearch = useDebouncedValue(search, 300);

  return useQuery({
    queryKey: [...QUERY_KEYS.STUDENT_OPTIONS, { search: debouncedSearch, active: true }],
    queryFn: () => studentsService.getStudentOptions({ search: debouncedSearch, limit: 20, isActive: true }),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}
