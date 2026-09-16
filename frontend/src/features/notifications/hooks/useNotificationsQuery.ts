
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { notificationsService } from '../api/notifications.service';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import type { NotificationFilterParams } from '../types/notifications.types';

export function useNotificationsQuery(params?: NotificationFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.NOTIFICATIONS, params],
    queryFn: () => notificationsService.getNotifications(params),
    refetchInterval: UI_CONSTANTS.NOTIFICATION_POLL_INTERVAL_MS,
  });
}

export function useUnreadCountQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATION_UNREAD_COUNT,
    queryFn: () => notificationsService.getUnreadCount(),
    refetchInterval: UI_CONSTANTS.NOTIFICATION_POLL_INTERVAL_MS,
  });
}
