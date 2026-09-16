
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { borrowingService } from '../api/borrowing.service';
import type { CreateBorrowingPayload } from '../types/borrowing.types';

export function useCreateBorrowingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: CreateBorrowingPayload;
    }) => borrowingService.createBorrowing(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.BORROWING,
        QUERY_KEYS.BORROWING_SUMMARY,
        QUERY_KEYS.EQUIPMENT,
        QUERY_KEYS.EQUIPMENT_SUMMARY,
        QUERY_KEYS.DASHBOARD_SUMMARY,
        QUERY_KEYS.NOTIFICATIONS,
        QUERY_KEYS.NOTIFICATION_UNREAD_COUNT,
      ]);
    },
  });
}
