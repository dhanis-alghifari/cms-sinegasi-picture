// src/features/notifications/components/NotificationDropdown.tsx
// Header notifications dropdown popover with unread badge and quick list

import { Bell, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useNotificationsQuery, useUnreadCountQuery } from '../queries/useNotificationsQuery';
import { formatNumber } from '@/shared/utils/formatNumber';
import { useMarkNotificationReadMutation } from '../mutations/useMarkNotificationReadMutation';
import { useMarkAllNotificationsReadMutation } from '../mutations/useMarkAllNotificationsReadMutation';
import { NotificationItem } from './NotificationItem';
import { useNavigate } from 'react-router-dom';

export function NotificationDropdown() {
  const navigate = useNavigate();
  const { data: unreadData } = useUnreadCountQuery();
  const { data: notificationsData } = useNotificationsQuery({ pageSize: 5 });

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
            className="relative h-9 w-9 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-lg"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-semantic-danger text-white font-bold text-[10px] flex items-center justify-center border-2 border-background animate-pulse">
                {unreadCount > 9 ? '9+' : formatNumber(unreadCount)}
              </span>
            )}
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-surface-3 border-hairline text-ink p-0 shadow-xl">
        <div className="p-3 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <span className="text-xs font-semibold text-ink">Notifikasi Sistem</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded">
                {formatNumber(unreadCount)} baru
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              className="text-[11px] text-ink-subtle hover:text-ink h-7 px-1.5"
            >
              <CheckCheck size={12} className="mr-1 text-semantic-success" />
              Tandai Semua Dibaca
            </Button>
          )}
        </div>

        <div className="p-2 space-y-1.5 max-h-80 overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <p className="text-center text-ink-tertiary text-xs py-6 italic">
              Belum ada notifikasi sistem.
            </p>
          ) : (
            recentNotifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={(id) => markReadMutation.mutate(id)}
              />
            ))
          )}
        </div>

        <div className="p-2 border-t border-hairline bg-surface-2/40">
          <DropdownMenuItem
            onClick={() => navigate('/notifications')}
            className="text-xs text-primary font-medium justify-center cursor-pointer hover:bg-surface-2"
          >
            Lihat Semua Notifikasi →
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
