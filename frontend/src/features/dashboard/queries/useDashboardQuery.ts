// src/features/dashboard/queries/useDashboardQuery.ts
// TanStack Query hook for dashboard summary

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { dashboardService } from '../services/dashboard.service';

export function useDashboardQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.DASHBOARD_SUMMARY,
    queryFn: () => dashboardService.getSummary(),
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
}
