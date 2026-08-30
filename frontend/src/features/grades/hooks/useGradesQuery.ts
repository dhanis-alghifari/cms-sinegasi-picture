// src/features/grades/hooks/useGradesQuery.ts
// TanStack Query hooks for grades & assignments

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { gradesService } from '../api/grades.service';
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

export function useGradeSummaryQuery(params?: Pick<GradeFilterParams, 'scope' | 'category'>, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.GRADES, 'summary', params],
    queryFn: () => gradesService.getSummary(params),
    enabled,
  });
}
