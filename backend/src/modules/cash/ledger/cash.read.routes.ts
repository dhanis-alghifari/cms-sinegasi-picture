import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { requireCapability } from '../../../middleware/capabilities.js';
import { cashSummaryRouteSchema, cashTransactionsRouteSchema } from '../shared/http/cash.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
import { CashReadService } from './cash.read.service.js';

export interface CashReadRoutesOptions {
  cashReadService: CashReadService;
}

const cashReadRoutes: FastifyPluginAsync<CashReadRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/cash/summary', {
    schema: cashSummaryRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const scope = { studentId: user.role === 'member' && /^[0-9a-fA-F-]{36}$/.test(user.studentId || '') ? user.studentId || null : null };
    try {
      return reply.send({ success: true, ...(await options.cashReadService.getSummary(scope)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/transactions', {
    schema: cashTransactionsRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const scope = { studentId: user.role === 'member' && /^[0-9a-fA-F-]{36}$/.test(user.studentId || '') ? user.studentId || null : null };
    try {
      const query = request.query as Record<string, string | undefined>;
      return reply.send({ success: true, ...(await options.cashReadService.listTransactions(query, scope)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashReadRoutes;
