
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { attendanceService } from '../api/attendance.service';
import type { CorrectAttendancePayload } from '../types/attendance.types';

export function useCorrectAttendanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Koreksi absensi berhasil disimpan.' },
    mutationFn: ({
      payload,
      changeReason,
    }: {
      payload: CorrectAttendancePayload;
      changeReason: string;
    }) => attendanceService.correctAttendance(payload, changeReason),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.ATTENDANCE,
        QUERY_KEYS.ATTENDANCE_SUMMARY,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
