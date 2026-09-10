import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { optionalTextSchema } from '@/shared/api/responseSchemas';
import {
  NOTIFICATION_TYPE_VALUES,
  type NotificationRecord,
  type UnreadCountResponse,
} from '../types/notifications.types';

const notificationTypeSchema = z.enum(NOTIFICATION_TYPE_VALUES);

const notificationSchema: z.ZodType<NotificationRecord> = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  type: notificationTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  link_url: optionalTextSchema,
  is_read: z.boolean(),
  created_at: z.string().min(1),
}).loose();

const unreadCountSchema: z.ZodType<UnreadCountResponse> = z.object({
  unread_count: z.number().int().nonnegative(),
}).loose();

export const decodeNotificationList = decodePaginatedResponse(notificationSchema);
export const decodeUnreadCount = decodeWithSchema(unreadCountSchema);
export const decodeNotification = decodeDataEnvelope(notificationSchema);
