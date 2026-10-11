import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { requireCapability, requireAnyCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../../auth/auth.identity.js';
import { resolveCashScope, scopeErrorMessage } from '../shared/cash.scope.js';
import {
  cashBillingRulesUpdateRouteSchema,
  cashDebtListRouteSchema,
  cashReportRouteSchema,
} from '../shared/http/cash.schema.js';
import { authenticatedRouteSchema } from '../../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
import { mapRequestFields } from '../../../shared/http/request-field-mapping.js';
import { CashReportingService } from './cash.reporting.service.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
};

export interface CashReportingRoutesOptions {
  reportingService: CashReportingService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

const managerGuard = requireCapability('cash.manage');

function reportingQuery(input: Record<string, unknown>): Record<string, string | undefined> {
  return mapRequestFields(input, { payment_method: 'metode_pembayaran' }) as Record<string, string | undefined>;
}

const cashReportingRoutes: FastifyPluginAsync<CashReportingRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/cash/report', {
    schema: cashReportRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (request, reply) => {
    try {
      return reply.send({ success: true, ...(await options.reportingService.getReport(reportingQuery(request.query as Record<string, unknown>)) ) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/debts', {
    schema: cashDebtListRouteSchema,
    preHandler: [authenticate, requireAnyCapability('cash.read', 'cash.read.own')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = request.query as Record<string, string | undefined>;
    const resolved = await resolveCashScope(user, query.scope, options.reportingService.repositoryIsConfigured() ? undefined : user.studentId);
    if (resolved.errorCode) return reply.status(403).send({ success: false, error_code: resolved.errorCode, message: scopeErrorMessage(resolved.errorCode) });
    const scope = { studentId: resolved.studentId };
    if (resolved.scope === 'own') delete query.student_id;
    try {
      return reply.send({ success: true, ...(await options.reportingService.listDebts(query, scope)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/billing-rules', {
    schema: authenticatedRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (_request, reply) => {
    try {
      const data = await options.reportingService.getBillingRules();
      return reply.send({ success: true, ...(data || {}) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.put('/api/cash/billing-rules', {
    schema: cashBillingRulesUpdateRouteSchema,
    preHandler: [authenticate, managerGuard],
  }, async (request, reply) => {
    const body = mapRequestFields((request.body || {}) as Record<string, unknown>, { mandatory_fee_amount: 'nominal_iuran_wajib' });
    const user = request.user as JwtPayload;
    const actorId = options.reportingService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    const changeReason = String(request.headers['x-change-reason'] || body.change_reason || '');
    try {
      const data = await options.reportingService.updateBillingRules(body, actorId, changeReason);
      await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'cash_settings', newValues: data as unknown as Record<string, unknown>, changeReason: changeReason.trim() });
      return reply.send({ success: true, ...(data || {}) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default cashReportingRoutes;
