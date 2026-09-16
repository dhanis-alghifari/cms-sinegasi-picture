import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { hasCapability, requireAnyCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseStudentId } from '../../auth/auth.identity.js';
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
    const own = !hasCapability(user.role, 'cash.read');
    const studentId = own ? await resolveDatabaseStudentId(user) : null;
    if (own && !studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun member belum terhubung ke data siswa.' });
    const scope = { studentId };
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
    const own = !hasCapability(user.role, 'cash.read');
    const query = cashTransactionQuery(request.query as Record<string, unknown>);
    const studentId = own ? await resolveDatabaseStudentId(user) : query.student_id || null;
    if (own && !studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun member belum terhubung ke data siswa.' });
    const scope = { studentId };
    try {
      return reply.send({ success: true, ...(await options.cashReadService.listTransactions(query, scope)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashReadRoutes;
