import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { requireCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../../auth/auth.identity.js';
import { cashInRouteSchema, cashOutRouteSchema } from '../shared/http/cash.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
import { CashMutationsService } from './cash.mutations.service.js';
import type { CashInInput, CashOutInput } from './cash.mutations.types.js';

export interface CashMutationsRoutesOptions {
  cashMutationsService: CashMutationsService;
}

const managerGuard = requireCapability('cash.manage');

const cashMutationsRoutes: FastifyPluginAsync<CashMutationsRoutesOptions> = async (fastify, options) => {
  fastify.post('/api/cash/transactions/in', {
    schema: cashInRouteSchema,
    preHandler: [authenticate, managerGuard],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.cashMutationsService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    const body = (request.body || {}) as CashInInput;
    const changeReason = String(request.headers['x-change-reason'] || 'Pencatatan transaksi kas masuk').trim();
    try {
      const result = await options.cashMutationsService.recordIn(body, actorId, request.headers['x-idempotency-key'] as string | undefined, changeReason);
      return reply.status(201).send({ success: true, data: result.cashTransaction, ...(result.result ? { result: result.result } : {}) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/cash/transactions/out', {
    schema: cashOutRouteSchema,
    preHandler: [authenticate, managerGuard],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.cashMutationsService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    const body = (request.body || {}) as CashOutInput;
    const changeReason = String(request.headers['x-change-reason'] || 'Pencatatan transaksi kas keluar').trim();
    try {
      const result = await options.cashMutationsService.recordOut(body, actorId, request.headers['x-idempotency-key'] as string | undefined, changeReason);
      return reply.status(201).send({ success: true, data: result.cashTransaction });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashMutationsRoutes;
