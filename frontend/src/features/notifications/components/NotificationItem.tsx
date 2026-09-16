
import {
  ClipboardCheck,
  Wallet,
  MessageSquareWarning,
  PackageCheck,
  CheckCircle2,
  XCircle,
  PencilLine,
  GraduationCap,
  Trophy,
  KeyRound,
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
  attendance_correction: <ClipboardCheck size={16} className="text-semantic-warning" />,
  grade_published: <GraduationCap size={16} className="text-primary" />,
  grade_correction: <PencilLine size={16} className="text-semantic-warning" />,
  cash_deducted: <Wallet size={16} className="text-semantic-danger" />,
  cash_dispute_response: <MessageSquareWarning size={16} className="text-semantic-warning" />,
  contest_assigned: <Trophy size={16} className="text-primary" />,
  password_reset: <KeyRound size={16} className="text-semantic-warning" />,
  borrowing_overdue: <PackageCheck size={16} className="text-semantic-danger" />,
  borrowing_approved: <CheckCircle2 size={16} className="text-semantic-success" />,
  borrowing_rejected: <XCircle size={16} className="text-semantic-danger" />,
  system_announcement: <Bell size={16} className="text-primary" />,
};

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const icon = notificationIcons[notification.type] || <Bell size={16} className="text-primary" />;
  const detailPath = getSafeInternalPath(notification.link_url);
  const isUnread = !notification.is_read;
  const titleId = `notification-title-${notification.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-hairline p-3 transition-colors',
        isUnread ? 'bg-surface-1' : 'bg-surface-1/60',
      )}
    >
      <div
        aria-hidden="true"
        className="shrink-0 rounded-lg border border-hairline bg-surface-2 p-2"
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex min-w-0 items-start gap-3">
          <p
            id={titleId}
            className={cn(
              'min-w-0 flex-1 truncate text-xs text-ink',
              isUnread ? 'font-semibold' : 'font-medium',
            )}
          >
            {notification.title}
          </p>
          <time
            dateTime={notification.created_at}
            className="shrink-0 text-[10px] text-ink-tertiary"
          >
            {formatDateShort(notification.created_at)}
          </time>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-ink-subtle">
          {notification.message}
        </p>

        <div className="mt-1 flex min-h-8 items-center justify-between gap-2">
          {detailPath ? (
            <a
              href={detailPath}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Lihat detail
            </a>
          ) : (
            <span />
          )}

          {isUnread && onMarkRead && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              aria-label={`Tandai ${notification.title} sebagai dibaca`}
              title="Tandai dibaca"
              className="flex min-h-8 min-w-8 items-center justify-center rounded-md border border-transparent text-ink-tertiary transition-colors hover:border-hairline hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100"
            >
              <Check size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        <span className="sr-only">
          {isUnread ? 'Belum dibaca' : 'Sudah dibaca'}
        </span>
      </div>
    </article>
  );
}
