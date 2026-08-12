import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationMemoryState } from './notifications.helpers.js';
import { createNotificationsRepository } from './notifications.repository.js';
import { NotificationsService, NotificationsServiceError } from './notifications.service.js';
import { mapNotificationRow } from './notifications.helpers.js';

function service() {
  const state = createNotificationMemoryState();
  return { service: new NotificationsService(createNotificationsRepository(null, state)), state };
}

test('notifications service filters and bounds pagination in memory', async () => {
  const { service: notificationsService } = service();
  const result = await notificationsService.list('usr-02', { page: 0, pageSize: 1000, isRead: false });
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 100);
  assert.equal(result.total, 1);
  assert.equal(result.unreadCount, 1);
  assert.equal(result.data[0]?.type, 'borrowing_approved');
});

test('notifications service marks only the authenticated user notification', async () => {
  const { service: notificationsService, state } = service();
  const marked = await notificationsService.markRead('notif-001', 'usr-02');
  assert.equal(marked.is_read, true);
  assert.equal(state.notifications.find((notification) => notification.id === 'notif-001')?.isRead, true);
  await assert.rejects(
    notificationsService.markRead('notif-001', 'usr-06'),
    (error: unknown) => error instanceof NotificationsServiceError && error.statusCode === 404,
  );
});

test('notifications service marks all unread notifications and reports the count', async () => {
  const { service: notificationsService } = service();
  assert.equal(await notificationsService.markAllRead('usr-02'), 1);
  assert.equal(await notificationsService.unreadCount('usr-02'), 0);
});

test('notification mapping rejects unsafe metadata links', () => {
  const mapped = mapNotificationRow({
    id: 'notif-safe', user_id: 'usr-02', type: 'system_alert', title: 'Alert', body: 'Body',
    metadata: { link_url: 'javascript:alert(1)' }, created_at: '2026-08-05T08:00:00.000Z',
  });
  assert.equal(mapped.link_url, undefined);
});
