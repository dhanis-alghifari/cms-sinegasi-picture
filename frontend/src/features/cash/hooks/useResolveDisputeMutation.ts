import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { cashService } from '../api/cash.service';
import type { DisputeStatus } from '../types/cash.types';

export function useResolveDisputeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ disputeId, status, review_note, resolution_date, payment_method_code }: { disputeId: string; status: DisputeStatus; review_note: string; resolution_date?: string; payment_method_code?: string }) =>
      cashService.resolveDispute(disputeId, { status, review_note, resolution_date, payment_method_code }, 'Verifikasi laporan sanggahan kas'),
    onSuccess: (_result, variables) => invalidateActiveQueries(queryClient, [
      QUERY_KEYS.CASH_DISPUTES,
      QUERY_KEYS.CASH_TRANSACTIONS,
      QUERY_KEYS.CASH_DEBT_RECORDS,
      QUERY_KEYS.CASH_DEBTS,
      ...(variables.status === 'approved' || variables.status === 'resolved'
        ? [QUERY_KEYS.CASH_BALANCE, QUERY_KEYS.CASH_REPORT, QUERY_KEYS.DASHBOARD_SUMMARY]
        : []),
    ]),
  });
}
