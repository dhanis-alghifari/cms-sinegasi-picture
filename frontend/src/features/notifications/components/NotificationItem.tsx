// src/features/notifications/components/NotificationItem.tsx
// Notification item card component with domain icons and read/unread status

import {
  Wallet,
  Lock,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  GraduationCap,
  Bell,
  Check,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { formatDateShort } from '@/shared/utils/formatDate';
import type { NotificationRecord, NotificationType } from '../types/notifications.types';
import { getSafeInternalPath } from '@/shared/utils/safeUrl';

interface NotificationItemProps {
  notification: NotificationRecord;
  onMarkRead?: (id: string) => void;
}

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  cash_debt_overdue: <Wallet size={16} className="text-semantic-danger" />,
  attendance_lock_warning: <Lock size={16} className="text-semantic-warning" />,
  borrowing_overdue: <PackageCheck size={16} className="text-semantic-danger" />,
  borrowing_approved: <CheckCircle2 size={16} className="text-semantic-success" />,
  borrowing_rejected: <XCircle size={16} className="text-semantic-danger" />,
  borrowing_submitted: <Clock3 size={16} className="text-semantic-warning" />,
  borrowing_handover: <PackageCheck size={16} className="text-primary" />,
  borrowing_returned: <CheckCircle2 size={16} className="text-semantic-success" />,
  grade_published: <GraduationCap size={16} className="text-primary" />,
  system_announcement: <Bell size={16} className="text-primary" />,
};

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const icon = notificationIcons[notification.type] || <Bell size={16} className="text-primary" />;

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors flex items-start gap-3 relative group',
        notification.is_read
          ? 'bg-surface-1/60 border-hairline/60 opacity-80'
          : 'bg-surface-1 border-primary/30 shadow-sm',
      )}
    >
      {/* Icon */}
      <div className="p-2 rounded-lg bg-surface-2 shrink-0 border border-hairline">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-xs font-semibold text-ink truncate">{notification.title}</p>
          <span className="text-[10px] text-ink-tertiary shrink-0">
            {formatDateShort(notification.created_at)}
          </span>
        </div>

        <p className="text-xs text-ink-subtle leading-relaxed line-clamp-2">
          {notification.message}
        </p>

        {getSafeInternalPath(notification.link_url) && (
          <a
            href={getSafeInternalPath(notification.link_url)}
            className="text-[11px] font-medium text-primary hover:underline mt-1 inline-block"
          >
            Lihat detail →
          </a>
        )}
      </div>

      {/* Unread indicator & Mark read button */}
      {!notification.is_read && (
        <div className="absolute right-3 top-3.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {onMarkRead && (
            <button
              onClick={() => onMarkRead(notification.id)}
              title="Tandai dibaca"
              className="text-ink-tertiary hover:text-ink transition-colors p-0.5"
            >
              <Check size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
