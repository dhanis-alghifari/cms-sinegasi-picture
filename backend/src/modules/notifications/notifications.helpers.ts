import type {
  NotificationDbRow,
  NotificationListQuery,
  NotificationMemoryEntry,
  NotificationMemoryState,
  NotificationRecord,
  NotificationType,
} from './notifications.types.js';

export const NOTIFICATIONS_SCHEMA_MESSAGE =
  'Skema notifikasi belum terpasang. Jalankan migration 003_notifications_table.sql dan 015_borrowing_notifications_hardening.sql di Supabase.';

export const notificationTypeMap: Record<string, NotificationType> = {
  attendance_correction: 'attendance_correction',
  grade_posted: 'grade_published',
  grade_correction: 'grade_correction',
  borrowing_approved: 'borrowing_approved',
  borrowing_rejected: 'borrowing_rejected',
  borrowing_overdue: 'borrowing_overdue',
  cash_deducted: 'cash_deducted',
  cash_dispute_response: 'cash_dispute_response',
  contest_assigned: 'contest_assigned',
  system_alert: 'system_announcement',
  password_reset: 'password_reset',
};

export function normalizeNotificationType(value: string): NotificationType {
  const normalized = notificationTypeMap[value];
  if (!normalized) throw new Error(`Unsupported notification type: ${value}`);
  return normalized;
}

export const DEFAULT_NOTIFICATIONS: NotificationMemoryEntry[] = [
  { id: 'notif-001', userId: 'usr-02', type: 'borrowing_approved', title: '✅ Peminjaman Alat Disetujui Guru', body: 'Peminjaman Kamera Sony Alpha A7 III telah disetujui oleh guru pembina.', isRead: false, metadata: { due_at: '2026-08-08' }, createdAt: '2026-08-05T08:00:00.000Z' },
  { id: 'notif-002', userId: 'usr-06', type: 'borrowing_overdue', title: '⚠️ Alat Pinjaman Telat Dikembalikan!', body: 'Peminjaman Anda telah melewati batas waktu pengembalian. Segera kembalikan alat ke lab.', isRead: false, metadata: { due_at: '2026-08-03' }, createdAt: '2026-08-04T07:00:00.000Z' },
  { id: 'notif-003', userId: 'usr-02', type: 'grade_posted', title: '📊 Nilai Baru Telah Diposting', body: 'Nilai untuk tugas "Sinematografi Dasar & Lighting Lab" telah diposting: Predikat A.', isRead: true, metadata: { nilai: 'A' }, createdAt: '2026-08-03T14:00:00.000Z' },
  { id: 'notif-004', userId: 'usr-05', type: 'attendance_correction', title: '✏️ Koreksi Absensi Diproses', body: 'Absensi Anda tanggal 4 Agustus 2026 telah dikoreksi dari Alpha menjadi Hadir.', isRead: false, metadata: { tanggal: '2026-08-04' }, createdAt: '2026-08-05T09:30:00.000Z' },
  { id: 'notif-005', userId: 'usr-04', type: 'cash_deducted', title: '💰 Iuran Kas Berhasil Diproses', body: 'Iuran kas bulan Agustus 2026 sebesar Rp 50.000 berhasil tercatat.', isRead: true, metadata: { nominal: 50000 }, createdAt: '2026-08-04T10:00:00.000Z' },
];

export function createNotificationMemoryState(): NotificationMemoryState {
  return { notifications: DEFAULT_NOTIFICATIONS.map((notification) => ({ ...notification, metadata: { ...notification.metadata } })) };
}

export function isMissingNotificationsSchemaError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  return Boolean(candidate && (
    ['PGRST205', '42P01', '42704', '42883'].includes(candidate.code || '')
    || candidate.message?.toLowerCase().includes('notifications')
    || candidate.message?.toLowerCase().includes('notification_type')
  ));
}

export function parseNotificationPagination(query: NotificationListQuery) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize) || 20)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function mapNotificationRow(row: NotificationDbRow): NotificationRecord {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    user_id: row.user_id,
    type: normalizeNotificationType(row.type),
    title: row.title,
    message: row.body ?? row.message ?? '',
    link_url: safeLinkUrl(metadata.link_url),
    is_read: row.is_read === true,
    created_at: row.created_at,
  };
}

export function mapMemoryNotification(entry: NotificationMemoryEntry): NotificationRecord {
  return {
    id: entry.id,
    user_id: entry.userId,
    type: normalizeNotificationType(entry.type),
    title: entry.title,
    message: entry.body,
    link_url: safeLinkUrl(entry.metadata.link_url),
    is_read: entry.isRead,
    created_at: entry.createdAt,
  };
}

function safeLinkUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  const candidate = value.trim();
  if (candidate.startsWith('/')) return candidate;
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export function safeNotificationErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { code?: string } | null | undefined;
  if (candidate?.code === '23505') return 'Notifikasi duplikat tidak dapat disimpan.';
  return fallback;
}
