import {
  isMissingNotificationsSchemaError,
  NOTIFICATIONS_SCHEMA_MESSAGE,
  safeNotificationErrorMessage,
} from './notifications.helpers.js';
import type { NotificationListQuery, NotificationsRepository } from './notifications.types.js';

export class NotificationsServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'NotificationsServiceError';
  }
}

function requiredId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new NotificationsServiceError(422, 'INVALID_INPUT', `${field} tidak valid.`);
  }
  return value.trim();
}

function serviceFailure(error: unknown, fallback: string): never {
  const missingSchema = isMissingNotificationsSchemaError(error);
  throw new NotificationsServiceError(
    missingSchema ? 503 : 500,
    missingSchema ? 'NOTIFICATIONS_SCHEMA_UNAVAILABLE' : 'NOTIFICATIONS_OPERATION_FAILED',
    missingSchema
      ? NOTIFICATIONS_SCHEMA_MESSAGE
      : safeNotificationErrorMessage(error, fallback),
  );
}

export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async unreadCount(userId: string) {
    const result = await this.repository.unreadCount(requiredId(userId, 'user_id'));
    if ('error' in result) serviceFailure(result.error, 'Gagal memuat jumlah notifikasi.');
    return result.data;
  }

  async list(userId: string, query: NotificationListQuery) {
    const result = await this.repository.list(requiredId(userId, 'user_id'), query);
    if ('error' in result) serviceFailure(result.error, 'Gagal memuat notifikasi.');
    return result.data;
  }

  async markRead(id: string, userId: string) {
    const result = await this.repository.markRead(requiredId(id, 'id'), requiredId(userId, 'user_id'));
    if ('error' in result) serviceFailure(result.error, 'Gagal menandai notifikasi.');
    if (!result.data) throw new NotificationsServiceError(404, 'NOTIFICATION_NOT_FOUND', 'Notifikasi tidak ditemukan.');
    return result.data;
  }

  async markAllRead(userId: string) {
    const result = await this.repository.markAllRead(requiredId(userId, 'user_id'));
    if ('error' in result) serviceFailure(result.error, 'Gagal menandai notifikasi.');
    return result.data;
  }
}
