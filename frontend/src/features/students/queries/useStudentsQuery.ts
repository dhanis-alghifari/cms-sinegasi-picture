// src/features/students/queries/useStudentsQuery.ts
// TanStack Query hook for students list with filter parameters

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../services/students.service';
import type { StudentFilterParams } from '../types/students.types';

export function useStudentsQuery(params?: StudentFilterParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STUDENTS, params],
    queryFn: () => studentsService.getStudents(params),
    enabled,
  });
}
