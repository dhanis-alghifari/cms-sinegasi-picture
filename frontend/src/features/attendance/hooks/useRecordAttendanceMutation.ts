// src/features/attendance/hooks/useRecordAttendanceMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { attendanceService } from '../api/attendance.service';
import type { RecordAttendancePayload } from '../types/attendance.types';

export function useRecordAttendanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: RecordAttendancePayload;
    }) => attendanceService.recordAttendance(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.ATTENDANCE,
        QUERY_KEYS.ATTENDANCE_SUMMARY,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
