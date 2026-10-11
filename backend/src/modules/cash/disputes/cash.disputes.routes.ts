import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, requireAnyRole, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { hasCapability, requireAnyCapability, requireCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseStudentId, resolveDatabaseUserId } from '../../auth/auth.identity.js';
import { resolveCashScope, scopeErrorMessage } from '../shared/cash.scope.js';
import {
  cashDisputeCreateRouteSchema,
  cashDisputeEvidenceRouteSchema,
  cashDisputeListRouteSchema,
  cashDisputeQuotaRouteSchema,
  cashDisputeUpdateRouteSchema,
} from '../shared/http/cash.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
import { mapRequestFields } from '../../../shared/http/request-field-mapping.js';
import { CashDisputesService } from './cash.disputes.service.js';
import { notifyCashDisputeSubmitted } from '../../../services/ntfyService.js';
import type { CashDisputeListQuery, CreateCashDisputeInput, ResolveCashDisputeInput } from './cash.disputes.types.js';

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

const managerCapabilityGuard = requireCapability('cash.dispute.review');

/** Dispute visibility is narrower than ledger access: only teachers review the global queue. */
async function resolveDisputeScope(user: JwtPayload, requestedScope: unknown, fallbackStudentId?: string) {
  const canReview = user.role === 'teacher' && hasCapability(user.role, 'cash.dispute.review');
  if (canReview) return resolveCashScope(user, 'manage', fallbackStudentId);

  if (requestedScope === 'manage') {
    if (!hasCapability(user.role, 'cash.dispute.read.all')) {
      return { scope: 'own' as const, studentId: null, errorCode: 'CASH_SCOPE_FORBIDDEN' as const };
    }
    return { scope: 'manage' as const, studentId: null };
  }

  if (!hasCapability(user.role, 'cash.dispute.read.own')) {
    return { scope: 'own' as const, studentId: null, errorCode: 'CASH_SCOPE_FORBIDDEN' as const };
  }

  return resolveCashScope(user, 'own', fallbackStudentId);
}

async function resolveActorStudentId(
  service: CashDisputesService,
  user: JwtPayload,
  actorId?: string,
): Promise<string | null | undefined> {
  if (service.repositoryIsConfigured()) return resolveDatabaseStudentId(user, actorId);
  return user.studentId || null;
}

const cashDisputesRoutes: FastifyPluginAsync<CashDisputesRoutesOptions> = async (fastify, options) => {
  fastify.post('/api/cash/disputes', {
    schema: cashDisputeCreateRouteSchema,
    preHandler: [authenticate, requireCapability('cash.dispute.create')],
  }, async (request, reply) => {
    const body = mapRequestFields((request.body || {}) as Record<string, unknown>, { evidence_url: 'bukti_sanggahan_url' }) as CreateCashDisputeInput;
    const user = request.user as JwtPayload;
    const actorId = options.disputesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid. Hubungi administrator.' });
    const idempotencyKey = String(request.headers['x-idempotency-key'] || '').trim();
    const actorStudentId = await resolveActorStudentId(options.disputesService, user, actorId);
    if (!actorStudentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun belum terhubung ke data siswa aktif.' });
    try {
      const data = await options.disputesService.create(body, actorId, idempotencyKey, actorStudentId);
      await options.persistAuditLog(request, {
        action: 'INSERT',
        tableName: 'cash_disputes',
        recordId: data.dispute.id,
        newValues: { transaction_id: data.dispute.transaction_id, debt_record_id: data.dispute.debt_record_id, student_id: data.dispute.student_id, attempt_number: data.dispute.attempt_number },
        changeReason: 'Pengajuan sanggahan transaksi kas',
      });
      if (!data.idempotentReplay) {
        void notifyCashDisputeSubmitted({ disputeId: data.dispute.id });
      }
      reply.header('Cache-Control', 'no-store');
      return reply.status(data.idempotentReplay ? 200 : 201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/disputes/quota', {
    schema: cashDisputeQuotaRouteSchema,
    preHandler: [authenticate, requireCapability('cash.dispute.create')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const studentId = await resolveActorStudentId(options.disputesService, user);
    if (!studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun member belum terhubung ke data siswa.' });
    try {
      reply.header('Cache-Control', 'no-store');
      return reply.send({ success: true, data: await options.disputesService.getQuota(studentId) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/disputes', {
    schema: cashDisputeListRouteSchema,
    preHandler: [authenticate, requireAnyCapability('cash.dispute.review', 'cash.dispute.read.all', 'cash.dispute.read.own')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const resolved = await resolveDisputeScope(user, (request.query as CashDisputeListQuery).scope, options.disputesService.repositoryIsConfigured() ? undefined : user.studentId);
    if (resolved.errorCode) return reply.status(403).send({ success: false, error_code: resolved.errorCode, message: scopeErrorMessage(resolved.errorCode) });
    try {
      const data = await options.disputesService.list(request.query as CashDisputeListQuery, resolved.studentId);
      return reply.send({ success: true, ...data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/disputes/:id/evidence', {
    schema: cashDisputeEvidenceRouteSchema,
    preHandler: [authenticate, requireAnyCapability('cash.dispute.review', 'cash.dispute.read.all', 'cash.dispute.read.own')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    const requestedScope = (request.query as { scope?: string }).scope;
    const resolved = await resolveDisputeScope(user, requestedScope, options.disputesService.repositoryIsConfigured() ? undefined : user.studentId);
    const studentId = resolved.scope === 'own' ? resolved.studentId : null;
    if (resolved.errorCode) return reply.status(403).send({ success: false, error_code: resolved.errorCode, message: scopeErrorMessage(resolved.errorCode) });
    try {
      reply.header('Cache-Control', 'no-store');
      return reply.send({ success: true, data: await options.disputesService.getEvidence(id, studentId) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.patch('/api/cash/disputes/:id', {
    schema: cashDisputeUpdateRouteSchema,
    preHandler: [authenticate, requireAnyRole('teacher'), managerCapabilityGuard],
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
        newValues: { status: data.dispute.status, review_note: data.dispute.review_note, resolution_transaction_id: data.resolutionTransactionId },
        changeReason: 'Verifikasi sanggahan transaksi kas',
      });
      reply.header('Cache-Control', 'no-store');
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashDisputesRoutes;
