
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { dashboardService } from '../api/dashboard.service';
import { UI_CONSTANTS } from '@/shared/constants/ui';

export function useDashboardQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.DASHBOARD_SUMMARY,
    queryFn: () => dashboardService.getSummary(),
    staleTime: UI_CONSTANTS.DASHBOARD_QUERY_STALE_TIME_MS,
  });
}
