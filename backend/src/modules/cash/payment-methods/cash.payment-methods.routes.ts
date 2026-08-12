import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { requireCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../../auth/auth.identity.js';
import { cashPaymentMethodCreateRouteSchema, cashPaymentMethodListRouteSchema, cashPaymentMethodUpdateRouteSchema } from '../shared/http/cash.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
import { CashPaymentMethodsService } from './cash.payment-methods.service.js';
import type { CashPaymentMethodInput } from '../shared/cash.types.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
};

export interface CashPaymentMethodsRoutesOptions {
  paymentMethodsService: CashPaymentMethodsService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

const managerGuard = requireCapability('cash.manage');

const cashPaymentMethodsRoutes: FastifyPluginAsync<CashPaymentMethodsRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/cash/payment-methods', {
    schema: cashPaymentMethodListRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (request, reply) => {
    const query = request.query as { include_inactive?: string };
    const includeInactive = query.include_inactive === 'true';
    const user = request.user as JwtPayload;
    if (includeInactive && !['teacher', 'treasurer'].includes(user.role)) return reply.status(403).send({ statusCode: 403, message: 'Anda tidak memiliki akses untuk melihat metode nonaktif.' });
    try {
      return reply.send({ success: true, data: await options.paymentMethodsService.list(includeInactive) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/cash/payment-methods', {
    schema: cashPaymentMethodCreateRouteSchema,
    preHandler: [authenticate, managerGuard],
  }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const user = request.user as JwtPayload;
    const actorId = options.paymentMethodsService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    const changeReason = String(request.headers['x-change-reason'] || body.change_reason || '');
    try {
      const data = await options.paymentMethodsService.create(body as CashPaymentMethodInput, actorId, changeReason);
      await options.persistAuditLog(request, { action: 'INSERT', tableName: 'cash_payment_methods', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: changeReason.trim() });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.patch('/api/cash/payment-methods/:id', {
    schema: cashPaymentMethodUpdateRouteSchema,
    preHandler: [authenticate, managerGuard],
  }, async (request, reply) => {
    const { id } = request.params as { id?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const user = request.user as JwtPayload;
    const actorId = options.paymentMethodsService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    const changeReason = String(request.headers['x-change-reason'] || body.change_reason || '');
    try {
      const result = await options.paymentMethodsService.update(id || '', body, actorId, changeReason);
      await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'cash_payment_methods', recordId: id || null, oldValues: result.previous as unknown as Record<string, unknown>, newValues: result.current as unknown as Record<string, unknown>, changeReason: changeReason.trim() });
      return reply.send({ success: true, data: result.current });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashPaymentMethodsRoutes;
