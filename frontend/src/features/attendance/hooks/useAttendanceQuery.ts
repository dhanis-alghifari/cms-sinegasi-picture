
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { attendanceService } from '../api/attendance.service';
import type { AttendanceFilterParams, AttendanceRosterParams, AttendanceSummaryParams } from '../types/attendance.types';

export function useAttendanceQuery(params?: AttendanceFilterParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE, params],
    queryFn: ({ signal }) => attendanceService.getAttendance(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAttendanceSummaryQuery(params?: AttendanceSummaryParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE_SUMMARY, params],
    queryFn: ({ signal }) => attendanceService.getSummary(params, { signal }),
    enabled,
  });
}

export function useAttendanceRosterQuery(params: AttendanceRosterParams, enabled = true) {
  const pageSize = params.pageSize ?? UI_CONSTANTS.DEFAULT_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE, 'roster', params.tanggal, params.kelas, pageSize],
    queryFn: ({ pageParam, signal }) => attendanceService.getRoster({ ...params, page: pageParam, pageSize }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
    ),
    enabled: enabled && Boolean(params.tanggal && params.kelas),
    staleTime: UI_CONSTANTS.SHORT_QUERY_STALE_TIME_MS,
  });
}
