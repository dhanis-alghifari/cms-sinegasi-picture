import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  authenticate,
  authorizeStudentDataAccess,
  enforceFirstLoginPasswordChange,
} from '../../middleware/authMiddleware.js';
import { requireAnyCapability } from '../../middleware/capabilities.js';
import { dashboardSummaryRouteSchema, studentDashboardSummaryRouteSchema } from '../../shared/http/schemas/dashboard.schema.js';
import { DashboardService, DashboardServiceError } from './dashboard.service.js';

export interface DashboardRoutesOptions {
  dashboardService: DashboardService;
}

function sendServiceError(error: unknown, reply: FastifyReply): unknown {
  if (!(error instanceof DashboardServiceError)) throw error;
  return reply.status(error.statusCode).send({
    statusCode: error.statusCode,
    message: error.message,
  });
}

const dashboardRoutes: FastifyPluginAsync<DashboardRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/dashboard/summary', {
    schema: dashboardSummaryRouteSchema,
    preHandler: [
      authenticate,
      enforceFirstLoginPasswordChange,
      requireAnyCapability('dashboard.read.operational', 'dashboard.read.own'),
    ],
  }, async (request, reply) => {
    try {
      return reply.send({
        success: true,
        ...(await options.dashboardService.getSummaryForUser(request.user as import('../../shared/auth/auth.types.js').JwtPayload)),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/students/:id/dashboard-summary', {
    schema: studentDashboardSummaryRouteSchema,
    preHandler: [authenticate, enforceFirstLoginPasswordChange, authorizeStudentDataAccess],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send({
        success: true,
        ...(await options.dashboardService.getStudentSummary(id)),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default dashboardRoutes;
