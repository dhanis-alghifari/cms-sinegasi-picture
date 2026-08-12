import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseStudentId } from '../auth/auth.identity.js';
import { borrowingListRouteSchema, borrowingSummaryRouteSchema } from '../../shared/http/schemas/borrowing.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { BorrowingReadService } from './borrowing.read.service.js';
import type { BorrowingReadQuery } from './borrowing.read.types.js';

export interface BorrowingReadRoutesOptions { borrowingReadService: BorrowingReadService; }
function isUuid(value: string | undefined): value is string { return Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)); }
const borrowingReadRoutes: FastifyPluginAsync<BorrowingReadRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/borrowing', { schema: borrowingListRouteSchema, preHandler: [authenticate, requireCapability('borrowing.read')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const studentId = user.role === 'member' ? (options.borrowingReadService.repositoryIsConfigured() ? await resolveDatabaseStudentId(user) : user.studentId || null) : null;
    if (user.role === 'member' && (!studentId || (options.borrowingReadService.repositoryIsConfigured() && !isUuid(studentId)))) return reply.send({ success: true, data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    try { return reply.send({ success: true, ...(await options.borrowingReadService.list(request.query as BorrowingReadQuery, { studentId })) }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/borrowing/summary', { schema: borrowingSummaryRouteSchema, preHandler: [authenticate, requireCapability('borrowing.read')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const studentId = user.role === 'member' ? (options.borrowingReadService.repositoryIsConfigured() ? await resolveDatabaseStudentId(user) : user.studentId || null) : null;
    if (user.role === 'member' && (!studentId || (options.borrowingReadService.repositoryIsConfigured() && !isUuid(studentId)))) return reply.send({ totalActive: 0, pendingApproval: 0, overdueCount: 0, returnedToday: 0 });
    try { return reply.send(await options.borrowingReadService.summary({ studentId })); } catch (error) { return sendServiceError(error, reply); }
  });
};

export default borrowingReadRoutes;
