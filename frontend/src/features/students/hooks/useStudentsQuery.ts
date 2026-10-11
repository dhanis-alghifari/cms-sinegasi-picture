
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';
import type { StudentFilterParams } from '../types/students.types';

export function useStudentsQuery(params?: StudentFilterParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STUDENTS, params],
    queryFn: () => studentsService.getStudents(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}
