// src/features/notifications/pages/NotificationsPage.tsx
// Thin orchestration page for Notifications Center

import { useState } from 'react';
import { CheckCheck } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/primitives/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';

import { useNotificationsQuery, useUnreadCountQuery } from '../hooks/useNotificationsQuery';
import { formatNumber } from '@/shared/utils/formatNumber';
import { useMarkNotificationReadMutation } from '../hooks/useMarkNotificationReadMutation';
import { useMarkAllNotificationsReadMutation } from '../hooks/useMarkAllNotificationsReadMutation';

import { NotificationItem } from '../components/NotificationItem';

export function NotificationsPage() {
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');

  const { data: unreadData } = useUnreadCountQuery();
  const {
    data: notificationsData,
    isLoading,
    isError,
    refetch: refetchNotifications,
  } = useNotificationsQuery({
    is_read: filterTab === 'unread' ? false : undefined,
  });

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const unreadCount = unreadData?.unread_count ?? 0;
  const notificationsList = notificationsData?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Pusat Notifikasi &amp; Peringatan Sistem"
        subtitle="Riwayat pengumuman, peringatan tunggakan kas, kunci absensi 48 jam, dan status peminjaman alat."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="w-full bg-surface-1 text-xs font-medium text-ink-subtle hover:text-ink sm:w-auto"
            >
              <CheckCheck size={14} aria-hidden="true" className="mr-1.5" />
              Tandai semua dibaca
            </Button>
          ) : undefined
        }
      />

      {/* Tabs Filter */}
      <Tabs value={filterTab} onValueChange={(val) => setFilterTab(val as 'all' | 'unread')}>
        <TabsList className="grid min-h-12 w-full grid-cols-2 gap-2 bg-surface-1 p-2 md:flex md:min-h-9 md:w-fit md:gap-2 md:p-1">
          <TabsTrigger value="all" className="min-h-12 min-w-0 flex-1 px-2 text-xs leading-tight md:min-h-9 md:min-w-40 md:flex-none md:whitespace-nowrap md:px-3">
            Semua Notifikasi
          </TabsTrigger>
          <TabsTrigger value="unread" className="min-h-12 min-w-0 flex-1 gap-2 px-2 text-xs leading-tight md:min-h-9 md:min-w-40 md:flex-none md:whitespace-nowrap md:px-3">
            <span>Belum Dibaca</span>
            {unreadCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-semantic-danger text-white text-[10px] font-bold flex items-center justify-center">
                {formatNumber(unreadCount)}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <EmptyState
          title="Notifikasi gagal dimuat"
          description="Terjadi kendala saat mengambil notifikasi. Silakan coba lagi."
          action={(
            <Button
              variant="outline"
              onClick={() => refetchNotifications()}
            >
              Coba lagi
            </Button>
          )}
        />
      ) : notificationsList.length === 0 ? (
        <EmptyState
          title="Tidak ada notifikasi"
          description={
            filterTab === 'unread'
              ? 'Semua notifikasi telah dibaca.'
              : 'Belum ada notifikasi sistem yang diterima.'
          }
        />
      ) : (
        <div className="space-y-2.5">
          {notificationsList.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={(id) => markReadMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
