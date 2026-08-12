import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { auditEntryRouteSchema, auditHistoryRouteSchema, auditListRouteSchema } from '../../shared/http/schemas/audit.schema.js';
import { AuditService, AuditServiceError } from './audit.service.js';
import type { AuditListQuery } from './audit.types.js';

export interface AuditRoutesOptions {
  auditService: AuditService;
}

function sendServiceError(error: unknown, reply: FastifyReply): unknown {
  if (!(error instanceof AuditServiceError)) throw error;
  return reply.status(error.statusCode).send({ success: false, message: error.message });
}

const auditRoutes: FastifyPluginAsync<AuditRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/audit-logs', {
    schema: auditListRouteSchema,
    preHandler: [authenticate, requireCapability('audit.read')],
  }, async (request, reply) => {
    try {
      const page = await options.auditService.list((request.query || {}) as AuditListQuery);
      return reply.send({ success: true, ...page });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/audit-logs/entry/:id', {
    schema: auditEntryRouteSchema,
    preHandler: [authenticate, requireCapability('audit.read')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send({ success: true, data: await options.auditService.getEntry(id) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/audit-logs/:tableName/:recordId', {
    schema: auditHistoryRouteSchema,
    preHandler: [authenticate, requireCapability('audit.read')],
  }, async (request, reply) => {
    try {
      const { tableName, recordId } = request.params as { tableName: string; recordId: string };
      const page = await options.auditService.listRecordHistory(tableName, recordId, (request.query || {}) as AuditListQuery);
      return reply.send({ success: true, ...page });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default auditRoutes;
