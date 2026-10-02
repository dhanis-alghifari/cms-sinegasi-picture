import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { borrowingService } from '../api/borrowing.service';
import type { ReturnReportPayload, VerifyReturnPayload } from '../types/borrowing.types';

const invalidateBorrowingData = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await invalidateActiveQueries(queryClient, [
    QUERY_KEYS.BORROWING,
    QUERY_KEYS.BORROWING_SUMMARY,
    QUERY_KEYS.EQUIPMENT,
    QUERY_KEYS.EQUIPMENT_SUMMARY,
    QUERY_KEYS.DASHBOARD_SUMMARY,
    QUERY_KEYS.NOTIFICATIONS,
    QUERY_KEYS.NOTIFICATION_UNREAD_COUNT,
  ]);
};

export function useSubmitReturnReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Laporan kondisi pengembalian berhasil dikirim.' },
    mutationFn: ({ borrowingId, payload, changeReason, idempotencyKey }: {
      borrowingId: string;
      payload: ReturnReportPayload;
      changeReason: string;
      idempotencyKey: string;
    }) => borrowingService.submitReturnReport(borrowingId, payload, changeReason, idempotencyKey),
    onSuccess: () => invalidateBorrowingData(queryClient),
  });
}

export function useVerifyReturnReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Laporan pengembalian berhasil diverifikasi.' },
    mutationFn: ({ borrowingId, payload, changeReason, idempotencyKey }: {
      borrowingId: string;
      payload: VerifyReturnPayload;
      changeReason: string;
      idempotencyKey: string;
    }) => borrowingService.verifyReturnReport(borrowingId, payload, changeReason, idempotencyKey),
    onSuccess: () => invalidateBorrowingData(queryClient),
  });
}
