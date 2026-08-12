// src/features/notifications/types/notifications.types.ts
// Notifications center domain types according to PRD schema

export type NotificationType =
  | 'cash_debt_overdue'
  | 'attendance_lock_warning'
  | 'borrowing_overdue'
  | 'borrowing_approved'
  | 'borrowing_rejected'
  | 'borrowing_submitted'
  | 'borrowing_handover'
  | 'borrowing_returned'
  | 'grade_published'
  | 'system_announcement';

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationFilterParams {
  page?: number;
  pageSize?: number;
  is_read?: boolean;
}

export interface UnreadCountResponse {
  unread_count: number;
}
