// src/features/borrowing/queries/useBorrowingQuery.ts
// TanStack Query hooks for borrowing domain

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { borrowingService } from '../services/borrowing.service';
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
