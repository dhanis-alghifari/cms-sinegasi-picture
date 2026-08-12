export type NotificationRecord = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
};

export type NotificationDbRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  message?: string | null;
  is_read?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type NotificationMemoryEntry = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type NotificationMemoryState = {
  notifications: NotificationMemoryEntry[];
};

export type NotificationListQuery = {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
};

export type NotificationListResult = {
  data: NotificationRecord[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type RepositoryResult<T> = { data: T } | { error: unknown };

export interface NotificationsRepository {
  isConfigured(): boolean;
  unreadCount(userId: string): Promise<RepositoryResult<number>>;
  list(userId: string, query: NotificationListQuery): Promise<RepositoryResult<NotificationListResult>>;
  markRead(id: string, userId: string): Promise<RepositoryResult<NotificationRecord | null>>;
  markAllRead(userId: string): Promise<RepositoryResult<number>>;
}
