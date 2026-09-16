
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { borrowingService } from '../api/borrowing.service';
import type { ProcessReturnPayload } from '../types/borrowing.types';

export function useReturnBorrowingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      changeReason,
    }: {
      payload: ProcessReturnPayload;
      changeReason: string;
    }) => borrowingService.processReturn(payload, changeReason),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.BORROWING,
        QUERY_KEYS.BORROWING_SUMMARY,
        QUERY_KEYS.EQUIPMENT,
        QUERY_KEYS.EQUIPMENT_SUMMARY,
        QUERY_KEYS.CASH_DEBTS,
        QUERY_KEYS.DASHBOARD_SUMMARY,
        QUERY_KEYS.NOTIFICATIONS,
        QUERY_KEYS.NOTIFICATION_UNREAD_COUNT,
      ]);
    },
  });
}

export function useReturnAssessmentPreviewMutation() {
  return useMutation({
    mutationFn: borrowingService.previewReturn,
  });
}
