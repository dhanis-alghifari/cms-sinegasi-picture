// src/features/attendance/queries/useAttendanceQuery.ts
// TanStack Query hooks for attendance domain

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceFilterParams } from '../types/attendance.types';

export function useAttendanceQuery(params?: AttendanceFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE, params],
    queryFn: () => attendanceService.getAttendance(params),
  });
}

export function useAttendanceSummaryQuery(tanggal?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE_SUMMARY, tanggal],
    queryFn: () => attendanceService.getSummary(tanggal),
  });
}
