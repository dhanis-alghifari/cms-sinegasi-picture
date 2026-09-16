import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { studentsService } from '../api/students.service';

export function useStudentOptionsQuery(search: string, enabled = true) {
  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

  return useQuery({
    queryKey: [...QUERY_KEYS.STUDENT_OPTIONS, { search: debouncedSearch, active: true }],
    queryFn: ({ signal }) => studentsService.getStudentOptions(
      { search: debouncedSearch, limit: UI_CONSTANTS.STUDENT_OPTIONS_LIMIT, isActive: true },
      { signal },
    ),
    enabled,
    staleTime: UI_CONSTANTS.QUERY_STALE_TIME_MS,
    placeholderData: (previousData) => previousData,
  });
}
