import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import { createNotificationMemoryState } from './notifications.helpers.js';
import { createNotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import notificationsRoutes from './notifications.routes.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(notificationsRoutes, {
    notificationsService: new NotificationsService(createNotificationsRepository(null, createNotificationMemoryState())),
  });
  return app;
}

test('notification routes require authentication and preserve list/unread envelopes', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  assert.equal((await app.inject({ method: 'GET', url: '/api/notifications' })).statusCode, 401);

  const token = app.jwt.sign({ userId: 'usr-02', username: 'member', role: 'member', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };
  const list = await app.inject({ method: 'GET', url: '/api/notifications?page=1&pageSize=1', headers });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().success, true);
  assert.equal(list.json().data.length, 1);
  assert.equal(typeof list.json().unreadCount, 'number');

  const unread = await app.inject({ method: 'GET', url: '/api/notifications/unread-count', headers });
  assert.equal(unread.statusCode, 200);
  assert.deepEqual(unread.json(), { unread_count: 1 });
});

test('notification read routes enforce ownership and support both read-all methods', async (t) => {
  const app = await createApp();
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'usr-02', username: 'member', role: 'member', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };

  const missing = await app.inject({ method: 'PATCH', url: '/api/notifications/not-owned/read', headers });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().success, false);

  const marked = await app.inject({ method: 'PATCH', url: '/api/notifications/notif-001/read', headers });
  assert.equal(marked.statusCode, 200);
  assert.equal(marked.json().data.is_read, true);

  const readAll = await app.inject({ method: 'POST', url: '/api/notifications/read-all', headers });
  assert.equal(readAll.statusCode, 200);
  assert.match(readAll.json().message, /notifikasi ditandai sudah dibaca/);
});
