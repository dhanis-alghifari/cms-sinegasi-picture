
import { apiClient } from '@/shared/api/client';
import {
  decodeNotification,
  decodeNotificationList,
  decodeUnreadCount,
} from './notifications.responses';
import { decodeVoidResponse } from '@/shared/api/responseValidation';
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
    return apiClient.getParsed(endpoint, decodeNotificationList);
  },

  getUnreadCount(): Promise<UnreadCountResponse> {
    return apiClient.getParsed('/api/notifications/unread-count', decodeUnreadCount);
  },

  markAsRead(id: string): Promise<NotificationRecord> {
    return apiClient.patchParsed(`/api/notifications/${id}/read`, {}, decodeNotification, {
      changeReason: 'Tandai notifikasi sebagai dibaca oleh pengguna',
    });
  },

  markAllAsRead(): Promise<void> {
    return apiClient.postParsed('/api/notifications/read-all', {}, decodeVoidResponse, {
      changeReason: 'Tandai semua notifikasi sebagai dibaca oleh pengguna',
    });
  },
};
