import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { accessControlAuditRouteSchema, accessControlMatrixRouteSchema, accessControlUpdateRouteSchema } from '../../shared/http/schemas/access-control.schema.js';
import { AccessControlService } from './access-control.service.js';

export interface AccessControlRoutesOptions {
  accessControlService: AccessControlService;
}

const accessControlRoutes: FastifyPluginAsync<AccessControlRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/access-control/matrix', {
    schema: accessControlMatrixRouteSchema,
    preHandler: [authenticate, requireCapability('access_control.read')],
  }, async (_request, reply) => {
    try {
      return reply.send({ success: true, data: await options.accessControlService.getMatrix() });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/access-control/audit-logs', {
    schema: accessControlAuditRouteSchema,
    preHandler: [authenticate, requireCapability('access_control.read')],
  }, async (request, reply) => {
    try {
      const query = request.query as { limit?: string } | undefined;
      const limit = Math.min(100, Math.max(1, Number(query?.limit || 100)));
      return reply.send({ success: true, data: await options.accessControlService.listAuditLogs(limit) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.put('/api/access-control/roles/:role/capabilities', {
    schema: accessControlUpdateRouteSchema,
    preHandler: [authenticate, requireCapability('access_control.manage')],
  }, async (request, reply) => {
    try {
      const body = (request.body || {}) as { capabilities?: unknown; change_reason?: unknown };
      const user = request.user as JwtPayload;
      return reply.send({
        success: true,
        data: await options.accessControlService.updateRoleCapabilities(
          user,
          (request.params as { role: string }).role,
          body.capabilities,
          body.change_reason,
          await resolveDatabaseUserId(user),
        ),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default accessControlRoutes;
