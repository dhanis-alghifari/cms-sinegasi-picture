
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { borrowingService } from '../api/borrowing.service';
import type { BorrowingFilterParams } from '../types/borrowing.types';

export function useBorrowingQuery(params?: BorrowingFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BORROWING, params],
    queryFn: () => borrowingService.getBorrowings(params),
  });
}

export function useBorrowingSummaryQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.BORROWING_SUMMARY,
    queryFn: () => borrowingService.getSummary(),
  });
}

export function useBorrowingReturnEvidenceQuery(borrowingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.BORROWING_RETURN_EVIDENCE(borrowingId || 'none'),
    queryFn: () => borrowingService.listReturnEvidence(borrowingId!),
    enabled: Boolean(borrowingId && enabled),
    staleTime: UI_CONSTANTS.LONG_QUERY_STALE_TIME_MS,
    retry: false,
  });
}

export function useBorrowingReturnReportQuery(borrowingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BORROWING, 'return-report', borrowingId || 'none'],
    queryFn: () => borrowingService.getReturnReport(borrowingId!),
    enabled: Boolean(borrowingId && enabled),
    staleTime: UI_CONSTANTS.LONG_QUERY_STALE_TIME_MS,
    retry: false,
  });
}

export function useBorrowingReturnReportEvidenceQuery(borrowingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BORROWING, 'return-report-evidence', borrowingId || 'none'],
    queryFn: () => borrowingService.listReturnReportEvidence(borrowingId!),
    enabled: Boolean(borrowingId && enabled),
    staleTime: UI_CONSTANTS.LONG_QUERY_STALE_TIME_MS,
    retry: false,
  });
}
