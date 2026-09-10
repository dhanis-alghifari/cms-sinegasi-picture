import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationMemoryState, mapNotificationRow } from './notifications.helpers.js';
import { createNotificationsRepository } from './notifications.repository.js';
import { NotificationsService, NotificationsServiceError } from './notifications.service.js';

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

test('notification mapping normalizes every database type to the public contract', () => {
  const expectedTypes = [
    ['attendance_correction', 'attendance_correction'],
    ['grade_posted', 'grade_published'],
    ['grade_correction', 'grade_correction'],
    ['borrowing_approved', 'borrowing_approved'],
    ['borrowing_rejected', 'borrowing_rejected'],
    ['borrowing_overdue', 'borrowing_overdue'],
    ['cash_deducted', 'cash_deducted'],
    ['cash_dispute_response', 'cash_dispute_response'],
    ['contest_assigned', 'contest_assigned'],
    ['system_alert', 'system_announcement'],
    ['password_reset', 'password_reset'],
  ] as const;

  for (const [databaseType, publicType] of expectedTypes) {
    const mapped = mapNotificationRow({
      id: `notification-${databaseType}`,
      user_id: 'usr-02',
      type: databaseType,
      title: 'Notification',
      body: 'Body',
      metadata: {},
      created_at: '2026-09-08T15:19:05.967Z',
    });
    assert.equal(mapped.type, publicType);
  }
});
