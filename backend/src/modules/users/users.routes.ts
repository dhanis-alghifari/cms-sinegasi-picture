import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import {
  authenticate,
  clearAuthStateCache,
  type JwtPayload,
} from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import {
  userCreateRouteSchema,
  userIdRouteSchema,
  userResetPasswordRouteSchema,
  usersListRouteSchema,
  userUpdateRouteSchema,
} from '../../shared/http/schemas/users.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { getAuditRequestContext } from '../../middleware/auditMiddleware.js';
import { mapRequestFields } from '../../shared/http/request-field-mapping.js';
import { UsersService } from './users.service.js';
import type { UserCreateInput, UserUpdateInput } from './users.types.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
  metadata?: Record<string, unknown>;
};

export interface UsersRoutesOptions {
  usersService: UsersService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

function requestBody(request: FastifyRequest): Record<string, unknown> {
  return (request.body || {}) as Record<string, unknown>;
}

function reasonFrom(request: FastifyRequest, body: Record<string, unknown>, fallback: string): string {
  const header = request.headers['x-change-reason'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const bodyReason = body.change_reason ?? body.changeReason;
  return typeof bodyReason === 'string' && bodyReason.trim() ? bodyReason.trim() : fallback;
}

function idempotencyKeyFrom(request: FastifyRequest): string {
  const value = request.headers['x-idempotency-key'];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

const usersRoutes: FastifyPluginAsync<UsersRoutesOptions> = async (fastify, options) => {
  const actorIdFor = async (request: FastifyRequest): Promise<string | null> => {
    const user = request.user as JwtPayload;
    return options.usersService.repositoryIsConfigured() ? resolveDatabaseUserId(user) : user.userId;
  };

  fastify.get('/api/users', { schema: usersListRouteSchema, preHandler: [authenticate, requireCapability('users.manage')] }, async (request, reply) => {
    try {
      const query = request.query as { page?: string; pageSize?: string; search?: string; role?: string; is_active?: string };
      return reply.send({ success: true, ...(await options.usersService.list({
        page: Number(query.page || 1),
        pageSize: Number(query.pageSize || 20),
        search: query.search,
        role: query.role,
        isActive: query.is_active && query.is_active !== 'all' ? query.is_active === 'true' : undefined,
      })) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/users/:id', { schema: userIdRouteSchema, preHandler: [authenticate, requireCapability('users.manage')] }, async (request, reply) => {
    try {
      return reply.send({ success: true, data: await options.usersService.findById((request.params as { id: string }).id) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/users', { schema: userCreateRouteSchema, preHandler: [authenticate, requireCapability('users.manage')] }, async (request, reply) => {
    try {
      const actorId = await actorIdFor(request);
      const body = mapRequestFields(requestBody(request), { name: 'nama' });
      const result = await options.usersService.create(body as unknown as UserCreateInput, actorId);
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'users', recordId: result.data.id,
        newValues: result.data as unknown as Record<string, unknown>,
        changeReason: 'Membuat akun operasional baru',
      });
      return reply.status(201).send({ success: true, data: result.data, temporary_password: result.temporaryPassword });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.put('/api/users/:id', { schema: userUpdateRouteSchema, preHandler: [authenticate, requireCapability('users.manage')] }, async (request, reply) => {
    try {
      const body = mapRequestFields(requestBody(request), { name: 'nama' });
      const result = await options.usersService.update(
        (request.params as { id: string }).id,
        body as unknown as UserUpdateInput,
        await actorIdFor(request),
        reasonFrom(request, body, ''),
        getAuditRequestContext(request),
      );
      clearAuthStateCache(result.data.id);
      return reply.send({ success: true, data: result.data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.delete('/api/users/:id', { schema: userIdRouteSchema, preHandler: [authenticate, requireCapability('users.manage')] }, async (request, reply) => {
    try {
      const reason = reasonFrom(request, requestBody(request), '');
      const result = await options.usersService.remove((request.params as { id: string }).id, await actorIdFor(request), reason);
      await options.persistAuditLog(request, {
        action: 'DELETE', tableName: 'users', recordId: result.data.id,
        oldValues: result.data as unknown as Record<string, unknown>,
        changeReason: reason,
        metadata: { operation: 'delete_unlinked_operational_account' },
      });
      return reply.send({ success: true, message: 'Akun operasional berhasil dihapus.' });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/users/:id/reset-password', {
    schema: userResetPasswordRouteSchema,
    config: { disableIdempotencyCache: true },
    preHandler: [authenticate, requireCapability('users.manage')],
  }, async (request, reply) => {
    try {
      const body = requestBody(request);
      const result = await options.usersService.resetPassword(
        (request.params as { id: string }).id,
        await actorIdFor(request),
        reasonFrom(request, body, ''),
        idempotencyKeyFrom(request),
        getAuditRequestContext(request),
      );
      clearAuthStateCache(result.userId);
      return reply.send({ success: true, userId: result.userId, temporary_password: result.temporaryPassword, message: result.message });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default usersRoutes;
