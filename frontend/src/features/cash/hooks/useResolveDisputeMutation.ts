import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { cashService } from '../api/cash.service';
import type { DisputeStatus } from '../types/cash.types';

export function useResolveDisputeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ disputeId, status, review_note, resolution_date, resolution_amount, payment_method_code }: { disputeId: string; status: DisputeStatus; review_note: string; resolution_date?: string; resolution_amount?: number; payment_method_code?: string }) =>
      cashService.resolveDispute(disputeId, { status, review_note, resolution_date, resolution_amount, payment_method_code }, 'Verifikasi laporan sanggahan kas'),
    onSuccess: () => invalidateActiveQueries(queryClient, [QUERY_KEYS.CASH_DISPUTES, QUERY_KEYS.CASH_TRANSACTIONS, QUERY_KEYS.CASH_DEBT_RECORDS, QUERY_KEYS.CASH_DEBTS]),
  });
}
