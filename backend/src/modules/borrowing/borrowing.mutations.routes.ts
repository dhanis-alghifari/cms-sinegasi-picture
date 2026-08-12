import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseStudentId, resolveDatabaseUserId } from '../auth/auth.identity.js';
import {
  borrowingApproveRejectRouteSchema,
  borrowingCreateRouteSchema,
  borrowingHandoverRouteSchema,
  borrowingReturnRouteSchema,
} from '../../shared/http/schemas/borrowing.schema.js';
import { BorrowingMutationsService, BorrowingMutationsServiceError } from './borrowing.mutations.service.js';
import type { BorrowingApprovalInput, BorrowingCreateInput, BorrowingReturnInput } from './borrowing.mutations.types.js';

export interface BorrowingMutationsRoutesOptions { borrowingMutationsService: BorrowingMutationsService; }

function sendServiceError(error: unknown, reply: FastifyReply, request: FastifyRequest, operation: string): unknown {
  if (error instanceof BorrowingMutationsServiceError && error.cause) {
    request.log.error({
      operation,
      code: (error.cause as { code?: unknown })?.code,
      message: (error.cause as { message?: unknown })?.message,
      details: (error.cause as { details?: unknown })?.details,
      hint: (error.cause as { hint?: unknown })?.hint,
    }, 'Borrowing database mutation failed');
  }
  if (error instanceof BorrowingMutationsServiceError) return reply.status(error.statusCode).send({ statusCode: error.statusCode, message: error.message });
  throw error;
}

async function actorIdFor(service: BorrowingMutationsService, user: JwtPayload): Promise<string | null> {
  return service.repositoryIsConfigured() ? resolveDatabaseUserId(user) : user.userId;
}

const borrowingMutationsRoutes: FastifyPluginAsync<BorrowingMutationsRoutesOptions> = async (fastify, options) => {
  fastify.post('/api/borrowing', {
    schema: borrowingCreateRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.manage')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = await actorIdFor(options.borrowingMutationsService, user);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    const memberStudentId = user.role === 'member' ? await resolveDatabaseStudentId(user) : null;
    try {
      const data = await options.borrowingMutationsService.create(
        (request.body || {}) as BorrowingCreateInput,
        user,
        memberStudentId,
        actorId,
        request.headers['x-idempotency-key'] as string | undefined,
      );
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply, request, 'create');
    }
  });

  fastify.post('/api/borrowing/:borrowing_id/approve-reject', {
    schema: borrowingApproveRejectRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.manage')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = await actorIdFor(options.borrowingMutationsService, user);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun Guru belum terhubung ke users.id database yang valid.' });
    const params = request.params as { borrowing_id: string };
    const body = { ...((request.body || {}) as BorrowingApprovalInput), change_reason: String(request.headers['x-change-reason'] || ((request.body || {}) as BorrowingApprovalInput).change_reason || ((request.body || {}) as BorrowingApprovalInput).alasan || '') };
    try {
      return reply.send({ success: true, data: await options.borrowingMutationsService.approveReject(params.borrowing_id, body, actorId) });
    } catch (error) {
      return sendServiceError(error, reply, request, 'approve-reject');
    }
  });

  fastify.post('/api/borrowing/:id/handover', {
    schema: borrowingHandoverRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.manage')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = await actorIdFor(options.borrowingMutationsService, user);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun pengguna belum terhubung ke users.id database yang valid.' });
    const params = request.params as { id: string };
    try {
      return reply.send({ success: true, data: await options.borrowingMutationsService.handover(params.id, actorId, String(request.headers['x-change-reason'] || '')) });
    } catch (error) {
      return sendServiceError(error, reply, request, 'handover');
    }
  });

  fastify.post('/api/borrowing/:borrowing_id/return', {
    schema: borrowingReturnRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.manage')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = await actorIdFor(options.borrowingMutationsService, user);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun pengguna belum terhubung ke users.id database yang valid.' });
    const params = request.params as { borrowing_id: string };
    try {
      return reply.send({ success: true, data: await options.borrowingMutationsService.returnBorrowing(
        params.borrowing_id,
        (request.body || {}) as BorrowingReturnInput,
        actorId,
        request.headers['x-change-reason'] as string | undefined,
      ) });
    } catch (error) {
      return sendServiceError(error, reply, request, 'return');
    }
  });
};

export default borrowingMutationsRoutes;
