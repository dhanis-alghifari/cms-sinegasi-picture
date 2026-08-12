import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../../middleware/authMiddleware.js';
import { requireCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../../auth/auth.identity.js';
import {
  cashBillingRulesUpdateRouteSchema,
  cashDebtListRouteSchema,
  cashReportRouteSchema,
} from '../shared/http/cash.schema.js';
import { authenticatedRouteSchema } from '../../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../../shared/http/sendServiceError.js';
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

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value));
}

const managerGuard = requireCapability('cash.manage');

const cashReportingRoutes: FastifyPluginAsync<CashReportingRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/cash/report', {
    schema: cashReportRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (request, reply) => {
    try {
      return reply.send({ success: true, ...(await options.reportingService.getReport(request.query as Record<string, string | undefined>)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/cash/debts', {
    schema: cashDebtListRouteSchema,
    preHandler: [authenticate, requireCapability('cash.read')],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    if (user.role === 'member' && !isUuid(user.studentId)) return reply.send({ success: true, data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    const scope = { studentId: user.role === 'member' ? user.studentId || null : null };
    try {
      return reply.send({ success: true, ...(await options.reportingService.listDebts(request.query as Record<string, string | undefined>, scope)) });
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
    const body = (request.body || {}) as Record<string, unknown>;
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
