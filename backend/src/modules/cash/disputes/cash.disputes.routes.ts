import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { requireCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../../auth/auth.identity.js';
import { cashDisputeCreateRouteSchema, cashDisputeUpdateRouteSchema } from '../shared/http/cash.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
import { CashDisputesService } from './cash.disputes.service.js';
import type { CreateCashDisputeInput, ResolveCashDisputeInput } from './cash.disputes.types.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
};

export interface CashDisputesRoutesOptions {
  disputesService: CashDisputesService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

const managerGuard = requireCapability('cash.manage');

const cashDisputesRoutes: FastifyPluginAsync<CashDisputesRoutesOptions> = async (fastify, options) => {
  fastify.post('/api/cash/disputes', {
    schema: cashDisputeCreateRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (request, reply) => {
    const body = (request.body || {}) as CreateCashDisputeInput;
    const user = request.user as JwtPayload;
    const actorId = options.disputesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid. Hubungi administrator.' });
    try {
      const data = await options.disputesService.create(body, actorId, user.role, user.studentId);
      await options.persistAuditLog(request, {
        action: 'INSERT',
        tableName: 'cash_disputes',
        recordId: data.id,
        newValues: { transaction_id: data.transaction_id, student_id: data.student_id },
        changeReason: 'Pengajuan sanggahan transaksi kas',
      });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.patch('/api/cash/disputes/:id', {
    schema: cashDisputeUpdateRouteSchema,
    preHandler: [authenticate, managerGuard],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as ResolveCashDisputeInput;
    const user = request.user as JwtPayload;
    const actorId = options.disputesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid. Hubungi administrator.' });
    try {
      const data = await options.disputesService.resolve(id, body, actorId);
      await options.persistAuditLog(request, {
        action: 'UPDATE',
        tableName: 'cash_disputes',
        recordId: id,
        newValues: { status: data.status },
        changeReason: 'Verifikasi sanggahan transaksi kas',
      });
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashDisputesRoutes;
