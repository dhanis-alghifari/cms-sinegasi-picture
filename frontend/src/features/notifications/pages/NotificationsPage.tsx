import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCheck } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/primitives/button';
import { AnimatedTabs } from '@/shared/ui/motion/animated-tabs';
import { formatNumber } from '@/shared/utils/formatNumber';
import { UI_CONSTANTS } from '@/shared/constants/ui';

import { useNotificationsQuery, useUnreadCountQuery } from '../hooks/useNotificationsQuery';
import { useMarkNotificationReadMutation } from '../hooks/useMarkNotificationReadMutation';
import { useMarkAllNotificationsReadMutation } from '../hooks/useMarkAllNotificationsReadMutation';

import { NotificationItem } from '../components/NotificationItem';

export function NotificationsPage() {
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const handleFilterTabChange = (value: string) => {
    if (value !== UI_CONSTANTS.ALL_FILTER_VALUE && value !== 'unread') return;
    setFilterTab(value);
  };

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
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
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

      <AnimatedTabs
        value={filterTab}
        onValueChange={handleFilterTabChange}
        ariaLabel="Filter notifikasi"
        ariaControls="notifications-list"
        id="notifications-filter"
        className="w-full md:w-fit"
        tabs={[
          { value: UI_CONSTANTS.ALL_FILTER_VALUE, label: 'Semua Notifikasi' },
          {
            value: 'unread',
            label: (
              <span className="inline-flex items-center gap-2">
                <span>Belum Dibaca</span>
                {unreadCount > 0 && (
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-semantic-danger text-[10px] font-bold text-white">
                    {formatNumber(unreadCount)}
                  </span>
                )}
              </span>
            ),
          },
        ]}
      />

      <div id="notifications-list" role="tabpanel" aria-labelledby={`notifications-filter-${filterTab}`} tabIndex={-1} className="min-h-[300px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={filterTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {isLoading && (
              <PageLoader />
            )}
            {isError && (
              <EmptyState
                title="Notifikasi gagal dimuat"
                description="Terjadi kendala saat mengambil notifikasi. Silakan coba lagi."
                action={(
                  <Button variant="outline" onClick={() => refetchNotifications()}>
                    Coba lagi
                  </Button>
                )}
              />
            )}
            {!isLoading && !isError && notificationsList.length === 0 && (
              <EmptyState
                title="Tidak ada notifikasi"
                description={
                  filterTab === 'unread'
                    ? 'Semua notifikasi telah dibaca.'
                    : 'Belum ada notifikasi sistem yang diterima.'
                }
              />
            )}
            {!isLoading && !isError && notificationsList.length > 0 && (
              <div className="space-y-2.5">
                {notificationsList.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={(id) => markReadMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
