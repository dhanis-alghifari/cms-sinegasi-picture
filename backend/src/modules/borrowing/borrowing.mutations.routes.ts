import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseStudentId, resolveDatabaseUserId } from '../auth/auth.identity.js';
import {
  borrowingApproveRejectRouteSchema,
  borrowingCreateRouteSchema,
  borrowingHandoverRouteSchema,
  borrowingReturnRouteSchema,
  borrowingReturnAssessmentRouteSchema,
  borrowingReturnEvidenceAccessRouteSchema,
  borrowingReturnEvidenceListRouteSchema,
  borrowingReturnEvidenceUploadRouteSchema,
} from '../../shared/http/schemas/borrowing.schema.js';
import { BorrowingMutationsService, BorrowingMutationsServiceError } from './borrowing.mutations.service.js';
import { mapRequestFields, mapRequestRecords } from '../../shared/http/request-field-mapping.js';
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
  if (error instanceof BorrowingMutationsServiceError) {
    return reply.status(error.statusCode).send({ statusCode: error.statusCode, error_code: error.errorCode, message: error.message });
  }
  throw error;
}

async function actorIdFor(service: BorrowingMutationsService, user: JwtPayload): Promise<string | null> {
  return service.repositoryIsConfigured() ? resolveDatabaseUserId(user) : user.userId;
}

const equipmentConditions: Readonly<Record<string, string>> = {
  good: 'bagus', minor_damage: 'sedikit_kerusakan', damaged: 'rusak', severely_damaged: 'rusak_besar', under_repair: 'sedang_diperbaiki', lost: 'hilang',
};

function borrowingInput(input: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRequestFields(input, {
    borrow_date: 'tanggal_pinjam', planned_return_date: 'rencana_kembali', purpose: 'keperluan', notes: 'keterangan',
    reason: 'alasan', return_date: 'tanggal_dikembalikan', return_notes: 'catatan_pengembalian',
  });
  const conditions = mapRequestRecords(mapped.item_conditions, { condition: 'kondisi_kembali', notes: 'catatan', settlement_method: 'settlement_method', repair_cost: 'repair_cost', evidence_urls: 'evidence_urls', evidence_ids: 'evidence_ids' });
  return {
    ...mapped,
    item_conditions: normalizeBorrowingConditions(conditions),
  };
}

function normalizeBorrowingConditions(conditions: unknown): unknown {
  if (!Array.isArray(conditions)) return conditions;
  return conditions.map((record) => {
    const item = record as Record<string, unknown>;
    if (typeof item.kondisi_kembali !== 'string') return item;
    return { ...item, kondisi_kembali: equipmentConditions[item.kondisi_kembali] ?? item.kondisi_kembali };
  });
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
        borrowingInput((request.body || {}) as Record<string, unknown>) as BorrowingCreateInput,
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
    const input = borrowingInput((request.body || {}) as Record<string, unknown>) as BorrowingApprovalInput;
    const body = { ...input, change_reason: String(request.headers['x-change-reason'] || input.change_reason || input.alasan || '') };
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
        borrowingInput((request.body || {}) as Record<string, unknown>) as BorrowingReturnInput,
        actorId,
        request.headers['x-change-reason'] as string | undefined,
      ) });
    } catch (error) {
      return sendServiceError(error, reply, request, 'return');
    }
  });

  fastify.post('/api/borrowing/:borrowing_id/return-assessment', {
    schema: borrowingReturnAssessmentRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.manage')],
  }, async (request, reply) => {
    try {
      const params = request.params as { borrowing_id: string };
      return reply.send({ success: true, data: await options.borrowingMutationsService.previewReturn(
        params.borrowing_id,
        borrowingInput((request.body || {}) as Record<string, unknown>) as BorrowingReturnInput,
      ) });
    } catch (error) {
      return sendServiceError(error, reply, request, 'return-assessment');
    }
  });

  fastify.post('/api/borrowing/:borrowing_id/return-evidence-uploads', {
    schema: borrowingReturnEvidenceUploadRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.manage')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = await actorIdFor(options.borrowingMutationsService, user);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const params = request.params as { borrowing_id: string };
      const body = (request.body || {}) as Record<string, unknown>;
      return reply.status(201).send({
        success: true,
        data: await options.borrowingMutationsService.reserveReturnEvidence(params.borrowing_id, {
          equipment_id: String(body.equipment_id || ''),
          file_name: String(body.file_name || ''),
          content_type: String(body.content_type || ''),
          file_size_bytes: Number(body.file_size_bytes),
        }, actorId),
      });
    } catch (error) {
      return sendServiceError(error, reply, request, 'return-evidence-upload');
    }
  });

  fastify.get('/api/borrowing-return-evidence/:evidence_id/access', {
    schema: borrowingReturnEvidenceAccessRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.read')],
  }, async (request, reply) => {
    try {
      const params = request.params as { evidence_id: string };
      return reply.send({ success: true, data: await options.borrowingMutationsService.getReturnEvidenceAccess(params.evidence_id) });
    } catch (error) {
      return sendServiceError(error, reply, request, 'return-evidence-access');
    }
  });

  fastify.get('/api/borrowing/:borrowing_id/return-evidence', {
    schema: borrowingReturnEvidenceListRouteSchema,
    preHandler: [authenticate, requireCapability('borrowing.read')],
  }, async (request, reply) => {
    try {
      const params = request.params as { borrowing_id: string };
      return reply.send({ success: true, data: await options.borrowingMutationsService.listReturnEvidence(params.borrowing_id) });
    } catch (error) {
      return sendServiceError(error, reply, request, 'return-evidence-list');
    }
  });
};

export default borrowingMutationsRoutes;
