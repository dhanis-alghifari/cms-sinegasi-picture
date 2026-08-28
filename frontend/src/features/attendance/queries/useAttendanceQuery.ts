// src/features/attendance/queries/useAttendanceQuery.ts
// TanStack Query hooks for attendance domain

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceFilterParams, AttendanceRosterParams } from '../types/attendance.types';

export function useAttendanceQuery(params?: AttendanceFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE, params],
    queryFn: () => attendanceService.getAttendance(params),
  });
}

export function useAttendanceSummaryQuery(tanggal?: string, scope?: 'own') {
  return useQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE_SUMMARY, tanggal, scope],
    queryFn: () => attendanceService.getSummary(tanggal, scope),
  });
}

export function useAttendanceRosterQuery(params: AttendanceRosterParams, enabled = true) {
  const pageSize = params.pageSize ?? 10;
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE, 'roster', params.tanggal, params.kelas, pageSize],
    queryFn: ({ pageParam }) => attendanceService.getRoster({ ...params, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
    ),
    enabled: enabled && Boolean(params.tanggal && params.kelas),
    staleTime: 30 * 1000,
  });
}
