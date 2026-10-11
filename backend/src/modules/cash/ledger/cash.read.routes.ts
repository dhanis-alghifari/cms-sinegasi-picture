import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { requireAnyCapability } from '../../../middleware/capabilities.js';
import { resolveCashScope, scopeErrorMessage } from '../shared/cash.scope.js';
import { cashSummaryRouteSchema, cashTransactionsRouteSchema } from '../shared/http/cash.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
import { mapRequestFields } from '../../../shared/http/request-field-mapping.js';
import { CashReadService } from './cash.read.service.js';

export interface CashReadRoutesOptions {
  cashReadService: CashReadService;
}

function cashTransactionQuery(input: Record<string, unknown>): Record<string, string | undefined> {
  const mapped = mapRequestFields(input, {
    type: 'tipe', start_date: 'tanggal_mulai', end_date: 'tanggal_selesai', payment_method: 'metode_pembayaran',
  });
  return {
    ...mapped,
    ...(mapped.tipe === 'income' ? { tipe: 'masuk' } : {}),
    ...(mapped.tipe === 'expense' ? { tipe: 'keluar' } : {}),
  } as Record<string, string | undefined>;
}

const cashReadRoutes: FastifyPluginAsync<CashReadRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/cash/summary', {
    schema: cashSummaryRouteSchema,
    preHandler: [authenticate, requireAnyCapability('cash.read', 'cash.read.own')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const repositoryIsConfigured = typeof options.cashReadService.repositoryIsConfigured === 'function'
      ? options.cashReadService.repositoryIsConfigured()
      : true;
    const resolved = await resolveCashScope(user, (request.query as { scope?: string }).scope, repositoryIsConfigured ? undefined : user.studentId);
    if (resolved.errorCode) return reply.status(403).send({ success: false, error_code: resolved.errorCode, message: scopeErrorMessage(resolved.errorCode) });
    const scope = { studentId: resolved.studentId };
    try {
      return reply.send({ success: true, ...(await options.cashReadService.getSummary(scope)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/transactions', {
    schema: cashTransactionsRouteSchema,
    preHandler: [authenticate, requireAnyCapability('cash.read', 'cash.read.own')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = cashTransactionQuery(request.query as Record<string, unknown>);
    const repositoryIsConfigured = typeof options.cashReadService.repositoryIsConfigured === 'function'
      ? options.cashReadService.repositoryIsConfigured()
      : true;
    const resolved = await resolveCashScope(user, query.scope, repositoryIsConfigured ? undefined : user.studentId);
    if (resolved.errorCode) return reply.status(403).send({ success: false, error_code: resolved.errorCode, message: scopeErrorMessage(resolved.errorCode) });
    const scope = { studentId: resolved.studentId };
    if (resolved.scope === 'own') delete query.student_id;
    try {
      return reply.send({ success: true, ...(await options.cashReadService.listTransactions(query, scope)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashReadRoutes;
