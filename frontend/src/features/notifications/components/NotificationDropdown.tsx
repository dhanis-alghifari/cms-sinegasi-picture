// src/features/notifications/components/NotificationDropdown.tsx
// Header notifications dropdown popover with unread badge and quick list

import { Bell, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Button } from '@/shared/ui/primitives/button';
import { useNotificationsQuery, useUnreadCountQuery } from '../hooks/useNotificationsQuery';
import { formatNumber } from '@/shared/utils/formatNumber';
import { useMarkNotificationReadMutation } from '../hooks/useMarkNotificationReadMutation';
import { useMarkAllNotificationsReadMutation } from '../hooks/useMarkAllNotificationsReadMutation';
import { NotificationItem } from './NotificationItem';
import { useNavigate } from 'react-router-dom';

export function NotificationDropdown() {
  const navigate = useNavigate();
  const { data: unreadData } = useUnreadCountQuery();
  const {
    data: notificationsData,
    isLoading: isNotificationsLoading,
    isError: hasNotificationsError,
    refetch: refetchNotifications,
  } = useNotificationsQuery({ pageSize: 5 });

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const unreadCount = unreadData?.unread_count ?? 0;
  const recentNotifications = notificationsData?.data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unreadCount > 0
                ? `Notifikasi, ${formatNumber(unreadCount)} belum dibaca`
                : 'Notifikasi'
            }
            className="relative h-9 w-9 rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-semantic-danger px-1 text-[10px] font-bold text-white"
              >
                {unreadCount > 9 ? '9+' : formatNumber(unreadCount)}
              </span>
            )}
          </Button>
        }
      />

      <DropdownMenuContent
        align="end"
        className="w-80 border-hairline bg-surface-3 p-0 text-ink shadow-xl sm:w-96"
      >
        <div className="flex items-center justify-between border-b border-hairline p-3">
          <div className="flex items-center gap-2">
            <Bell size={16} aria-hidden="true" className="text-primary" />
            <span className="text-xs font-semibold text-ink">Notifikasi Sistem</span>
            {unreadCount > 0 && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {formatNumber(unreadCount)} baru
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="h-7 px-1.5 text-[11px] text-ink-subtle hover:text-ink"
            >
              <CheckCheck size={12} aria-hidden="true" className="mr-1" />
              Tandai semua dibaca
            </Button>
          )}
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto p-2">
          {isNotificationsLoading ? (
            <p className="py-6 text-center text-xs text-ink-tertiary">
              Memuat notifikasi...
            </p>
          ) : hasNotificationsError ? (
            <div className="px-3 py-6 text-center" role="alert">
              <p className="text-xs text-ink-subtle">Notifikasi gagal dimuat.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchNotifications()}
                className="mt-2 h-7 px-2 text-[11px] text-primary"
              >
                Coba lagi
              </Button>
            </div>
          ) : recentNotifications.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-ink-tertiary">
              Belum ada notifikasi sistem.
            </p>
          ) : (
            recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={(id) => markReadMutation.mutate(id)}
              />
            ))
          )}
        </div>

        <div className="border-t border-hairline bg-surface-2/40 p-2">
          <DropdownMenuItem
            onClick={() => navigate('/notifications')}
            className="cursor-pointer justify-center text-xs font-medium text-primary hover:bg-surface-2"
          >
            Lihat semua notifikasi
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
