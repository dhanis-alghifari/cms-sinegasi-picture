
export const NOTIFICATION_TYPE_VALUES = [
  'attendance_correction',
  'grade_published',
  'grade_correction',
  'borrowing_approved',
  'borrowing_rejected',
  'borrowing_overdue',
  'cash_deducted',
  'cash_dispute_response',
  'contest_assigned',
  'system_announcement',
  'password_reset',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPE_VALUES[number];

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
