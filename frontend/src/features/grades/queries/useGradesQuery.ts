// src/features/grades/queries/useGradesQuery.ts
// TanStack Query hooks for grades & assignments

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { gradesService } from '../services/grades.service';
import type { AssignmentFilterParams, GradeFilterParams } from '../types/grades.types';

export function useGradesQuery(params?: GradeFilterParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.GRADES, params],
    queryFn: () => gradesService.getGrades(params),
    enabled,
  });
}

export function useAssignmentsQuery(params?: AssignmentFilterParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ASSIGNMENTS, params],
    queryFn: () => gradesService.getAssignments(params),
    enabled,
  });
}
