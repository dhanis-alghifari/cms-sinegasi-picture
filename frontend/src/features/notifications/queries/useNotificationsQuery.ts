// src/features/notifications/queries/useNotificationsQuery.ts
// TanStack Query hooks for notifications domain with automated polling

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { notificationsService } from '../services/notifications.service';
import type { NotificationFilterParams } from '../types/notifications.types';

export function useNotificationsQuery(params?: NotificationFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.NOTIFICATIONS, params],
    queryFn: () => notificationsService.getNotifications(params),
    refetchInterval: 30000,
  });
}

export function useUnreadCountQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATION_UNREAD_COUNT,
    queryFn: () => notificationsService.getUnreadCount(),
    refetchInterval: 30000, // Poll unread notifications count every 30 seconds
  });
}
