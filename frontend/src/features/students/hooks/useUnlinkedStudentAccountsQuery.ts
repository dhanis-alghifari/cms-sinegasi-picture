import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';

export function useUnlinkedStudentAccountsQuery(search: string, enabled: boolean) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STUDENT_UNLINKED_ACCOUNTS, search],
    queryFn: ({ signal }) => studentsService.getUnlinkedAccounts({ search, limit: 20 }, { signal }),
    enabled,
    staleTime: 15_000,
  });
}
