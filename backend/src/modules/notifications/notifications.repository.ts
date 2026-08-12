import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mapMemoryNotification,
  mapNotificationRow,
  parseNotificationPagination,
  DEFAULT_NOTIFICATIONS,
} from './notifications.helpers.js';
import type {
  NotificationDbRow,
  NotificationListQuery,
  NotificationMemoryState,
  NotificationListResult,
  NotificationRecord,
  NotificationsRepository,
  RepositoryResult,
} from './notifications.types.js';

type SupabaseLike = SupabaseClient | null;

const NOTIFICATION_SELECT = 'id,user_id,type,title,body,message,is_read,metadata,created_at';

export function createNotificationsRepository(
  client: SupabaseLike,
  state: NotificationMemoryState,
): NotificationsRepository {
  if (!client && state.notifications.length === 0) {
    state.notifications.push(...DEFAULT_NOTIFICATIONS.map((notification) => ({ ...notification, metadata: { ...notification.metadata } })));
  }

  return {
    isConfigured: () => client !== null,

    async unreadCount(userId): Promise<RepositoryResult<number>> {
      if (!client) {
        return { data: state.notifications.filter((notification) => notification.userId === userId && !notification.isRead).length };
      }
      const result = await client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (result.error) return { error: result.error };
      return { data: result.count || 0 };
    },

    async list(userId, query): Promise<RepositoryResult<NotificationListResult>> {
      const { page, pageSize, from, to } = parseNotificationPagination(query);
      if (!client) {
        let rows = state.notifications
          .filter((notification) => notification.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id));
        if (query.isRead !== undefined) rows = rows.filter((notification) => notification.isRead === query.isRead);
        const total = rows.length;
        const unreadCount = state.notifications.filter((notification) => notification.userId === userId && !notification.isRead).length;
        return {
          data: {
            data: rows.slice(from, to + 1).map(mapMemoryNotification),
            unreadCount,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
          },
        };
      }

      let dbQuery = client
        .from('notifications')
        .select(NOTIFICATION_SELECT, { count: 'exact' })
        .eq('user_id', userId);
      if (query.isRead !== undefined) dbQuery = dbQuery.eq('is_read', query.isRead);

      const [{ data, count, error }, unreadResult] = await Promise.all([
        dbQuery
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
        client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false),
      ]);
      if (error || unreadResult.error) return { error: error || unreadResult.error };
      const total = count || 0;
      return {
        data: {
          data: ((data || []) as NotificationDbRow[]).map(mapNotificationRow),
          unreadCount: unreadResult.count || 0,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    },

    async markRead(id, userId): Promise<RepositoryResult<NotificationRecord | null>> {
      if (!client) {
        const notification = state.notifications.find((entry) => entry.id === id && entry.userId === userId);
        if (!notification) return { data: null };
        notification.isRead = true;
        return { data: mapMemoryNotification(notification) };
      }
      const result = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .select(NOTIFICATION_SELECT)
        .maybeSingle();
      if (result.error) return { error: result.error };
      return { data: result.data ? mapNotificationRow(result.data as NotificationDbRow) : null };
    },

    async markAllRead(userId): Promise<RepositoryResult<number>> {
      if (!client) {
        let count = 0;
        for (const notification of state.notifications) {
          if (notification.userId === userId && !notification.isRead) {
            notification.isRead = true;
            count++;
          }
        }
        return { data: count };
      }
      const unread = await client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (unread.error) return { error: unread.error };
      if (!unread.count) return { data: 0 };
      const updated = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (updated.error) return { error: updated.error };
      return { data: unread.count };
    },
  };
}
