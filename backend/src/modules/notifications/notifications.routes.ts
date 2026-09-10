import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { authenticate, enforceFirstLoginPasswordChange, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import {
  notificationIdRouteSchema,
  notificationsListRouteSchema,
  readAllNotificationsRouteSchema,
  unreadCountRouteSchema,
} from '../../shared/http/schemas/notifications.schema.js';
import { NotificationsService, NotificationsServiceError } from './notifications.service.js';

export interface NotificationsRoutesOptions {
  notificationsService: NotificationsService;
}

function sendError(error: unknown, reply: FastifyReply, notFoundEnvelope = false): unknown {
  if (!(error instanceof NotificationsServiceError)) throw error;
  if (notFoundEnvelope && error.statusCode === 404) {
    return reply.status(404).send({ success: false, message: error.message });
  }
  return reply.status(error.statusCode).send({ statusCode: error.statusCode, message: error.message });
}

const notificationsRoutes: FastifyPluginAsync<NotificationsRoutesOptions> = async (fastify, options) => {
  const userIdFor = async (request: FastifyRequest): Promise<string | null> => {
    const user = request.user as JwtPayload;
    return options.notificationsService.repositoryIsConfigured()
      ? resolveDatabaseUserId(user)
      : user.userId;
  };

  fastify.get('/api/notifications/unread-count', { schema: unreadCountRouteSchema, preHandler: [authenticate, requireCapability('notifications.read')] }, async (request, reply) => {
    const userId = await userIdFor(request);
    if (!userId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      return reply.send({ unread_count: await options.notificationsService.unreadCount(userId) });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  fastify.get('/api/notifications', {
    schema: notificationsListRouteSchema,
    preHandler: [authenticate, enforceFirstLoginPasswordChange, requireCapability('notifications.read')],
  }, async (request, reply) => {
    const userId = await userIdFor(request);
    if (!userId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const query = request.query as { page?: string; pageSize?: string; is_read?: string; unread_only?: string };
      const isRead = query.is_read !== undefined
        ? query.is_read === 'true'
        : query.unread_only === 'true' ? false : undefined;
      return reply.send({ success: true, ...(await options.notificationsService.list(userId, {
        page: Number(query.page || 1),
        pageSize: Number(query.pageSize || 20),
        isRead,
      })) });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  fastify.patch('/api/notifications/:id/read', {
    schema: notificationIdRouteSchema,
    preHandler: [authenticate, requireCapability('notifications.read')],
  }, async (request, reply) => {
    const userId = await userIdFor(request);
    if (!userId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const { id } = request.params as { id: string };
      return reply.send({ success: true, data: await options.notificationsService.markRead(id, userId) });
    } catch (error) {
      return sendError(error, reply, true);
    }
  });

  const markAllRead = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await userIdFor(request);
    if (!userId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const count = await options.notificationsService.markAllRead(userId);
      return reply.send({ success: true, message: `${count} notifikasi ditandai sudah dibaca.` });
    } catch (error) {
      return sendError(error, reply);
    }
  };

  fastify.patch('/api/notifications/read-all', { schema: readAllNotificationsRouteSchema, preHandler: [authenticate, requireCapability('notifications.read')] }, markAllRead);
  fastify.post('/api/notifications/read-all', { schema: readAllNotificationsRouteSchema, preHandler: [authenticate, requireCapability('notifications.read')] }, markAllRead);
};

export default notificationsRoutes;
