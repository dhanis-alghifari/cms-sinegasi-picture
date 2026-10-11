
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { gradesService } from '../api/grades.service';
import type { BulkGradingPayload } from '../types/grades.types';

export function useBulkGradingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Penilaian massal berhasil disimpan.' },
    mutationFn: ({
      payload,
      changeReason,
    }: {
      payload: BulkGradingPayload;
      changeReason: string;
    }) => gradesService.bulkGrade(payload, changeReason),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.GRADES,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
