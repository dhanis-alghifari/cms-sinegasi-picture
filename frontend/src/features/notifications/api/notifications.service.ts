// src/features/notifications/api/notifications.service.ts
// Pure TS notifications service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  NotificationRecord,
  NotificationFilterParams,
  UnreadCountResponse,
} from '../types/notifications.types';

export const notificationsService = {
  getNotifications(params?: NotificationFilterParams): Promise<PaginatedResponse<NotificationRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.is_read !== undefined) query.append('is_read', String(params.is_read));

    const endpoint = `/api/notifications${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<NotificationRecord>>(endpoint);
  },

  getUnreadCount(): Promise<UnreadCountResponse> {
    return apiClient.get<UnreadCountResponse>('/api/notifications/unread-count');
  },

  markAsRead(id: string): Promise<NotificationRecord> {
    return apiClient.patch<NotificationRecord>(`/api/notifications/${id}/read`, {}, {
      changeReason: 'Tandai notifikasi sebagai dibaca oleh pengguna',
    });
  },

  markAllAsRead(): Promise<void> {
    return apiClient.post<void>('/api/notifications/read-all', {}, {
      changeReason: 'Tandai semua notifikasi sebagai dibaca oleh pengguna',
    });
  },
};
