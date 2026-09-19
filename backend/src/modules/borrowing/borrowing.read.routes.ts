import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseStudentId } from '../auth/auth.identity.js';
import { borrowingListRouteSchema, borrowingSummaryRouteSchema } from '../../shared/http/schemas/borrowing.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { mapRequestFields } from '../../shared/http/request-field-mapping.js';
import { BorrowingReadService } from './borrowing.read.service.js';
import type { BorrowingReadQuery } from './borrowing.read.types.js';

export interface BorrowingReadRoutesOptions { borrowingReadService: BorrowingReadService; }
function isUuid(value: string | undefined): value is string { return Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)); }
const borrowingStatuses: Readonly<Record<string, string>> = { pending_approval: 'menunggu_persetujuan', approved: 'disetujui', rejected: 'ditolak', borrowed: 'dipinjam', pending_verification: 'menunggu_verifikasi', returned: 'dikembalikan', overdue: 'terlambat' };

function isPersonalBorrowingRole(user: JwtPayload): boolean {
  return user.role === 'member' || user.role === 'contest_team';
}

async function resolvePersonalStudentId(service: BorrowingReadService, user: JwtPayload): Promise<string | null> {
  if (!isPersonalBorrowingRole(user)) return null;
  if (service.repositoryIsConfigured()) return resolveDatabaseStudentId(user);
  return user.studentId || null;
}

const borrowingReadRoutes: FastifyPluginAsync<BorrowingReadRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/borrowing', { schema: borrowingListRouteSchema, preHandler: [authenticate, requireCapability('borrowing.read')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const studentId = await resolvePersonalStudentId(options.borrowingReadService, user);
    if (isPersonalBorrowingRole(user) && (!studentId || (options.borrowingReadService.repositoryIsConfigured() && !isUuid(studentId)))) return reply.send({ success: true, data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    try {
      const query = mapRequestFields(request.query as Record<string, unknown>, {}) as BorrowingReadQuery;
      if (typeof query.status === 'string') query.status = borrowingStatuses[query.status] ?? query.status;
      return reply.send({ success: true, ...(await options.borrowingReadService.list(query, { studentId })) });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/borrowing/summary', { schema: borrowingSummaryRouteSchema, preHandler: [authenticate, requireCapability('borrowing.read')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const studentId = await resolvePersonalStudentId(options.borrowingReadService, user);
    if (isPersonalBorrowingRole(user) && (!studentId || (options.borrowingReadService.repositoryIsConfigured() && !isUuid(studentId)))) return reply.send({ totalActive: 0, pendingApproval: 0, overdueCount: 0, returnedToday: 0 });
    try { return reply.send(await options.borrowingReadService.summary({ studentId })); } catch (error) { return sendServiceError(error, reply); }
  });
};

export default borrowingReadRoutes;
