import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { getAuditRequestContext } from '../../middleware/auditMiddleware.js';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { authenticatedRouteSchema } from '../../shared/http/schemas/core.schema.js';
import {
  contestEntryCreateRouteSchema,
  contestEntryDetailRouteSchema,
  contestEntryFinalizeRouteSchema,
  contestEntryListRouteSchema,
  contestEntryTransitionRouteSchema,
  contestEvidenceAccessRouteSchema,
  contestEvidenceUploadRouteSchema,
} from '../../shared/http/schemas/contest-entries.schema.js';
import { ContestEntriesService } from './contest-entries.service.js';
import type {
  ContestEntryListQuery,
  ContestEntryMutationContext,
  CreateContestEntryInput,
  FinalizeContestEntryInput,
  ReserveContestEvidenceInput,
  TransitionContestEntryInput,
} from './contest-entries.types.js';

type AuditInput = { action: string; tableName: string; recordId?: string | null; newValues?: Record<string, unknown> | null; changeReason: string };
export interface ContestEntriesRoutesOptions { contestEntriesService: ContestEntriesService; persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>; }

function mutationContext(request: FastifyRequest): ContestEntryMutationContext {
  const audit = getAuditRequestContext(request);
  return {
    idempotencyKey: String(request.headers['x-idempotency-key'] || ''),
    requestId: audit?.requestId,
    operationId: audit?.operationId,
    userAgent: audit?.userAgent || request.headers['user-agent'],
  };
}

const contestEntriesRoutes: FastifyPluginAsync<ContestEntriesRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/contest-work-types', { schema: authenticatedRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (_request, reply) => {
    try {
      return reply.send({ success: true, data: await options.contestEntriesService.listWorkTypes() });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/contests/:contestId/entries', { schema: contestEntryListRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      const params = request.params as { contestId: string };
      return reply.send({ success: true, ...(await options.contestEntriesService.list(params.contestId, (request.query || {}) as ContestEntryListQuery)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contests/:contestId/entries', { schema: contestEntryCreateRouteSchema, preHandler: [authenticate, requireCapability('contests.submit')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestEntriesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
      const params = request.params as { contestId: string };
      const body = { ...(request.body as CreateContestEntryInput), contest_id: params.contestId };
      const data = await options.contestEntriesService.create(body, actorId);
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'contest_entries', recordId: data.id,
        newValues: data as unknown as Record<string, unknown>,
        changeReason: String(request.headers['x-change-reason'] || 'Mendaftarkan karya ke event'),
      });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/contest-entries/:id', { schema: contestEntryDetailRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      return reply.send({ success: true, data: await options.contestEntriesService.get((request.params as { id: string }).id) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contest-entries/:id/evidence-uploads', { schema: contestEvidenceUploadRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestEntriesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
      const data = await options.contestEntriesService.reserveEvidence(
        (request.params as { id: string }).id,
        request.body as ReserveContestEvidenceInput,
        actorId,
      );
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contest-entries/:id/transitions', { schema: contestEntryTransitionRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestEntriesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
      const body = request.body as TransitionContestEntryInput;
      const data = await options.contestEntriesService.transition(
        (request.params as { id: string }).id,
        body,
        actorId,
        mutationContext(request),
      );
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contest-entries/:id/finalize', { schema: contestEntryFinalizeRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestEntriesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
      const data = await options.contestEntriesService.finalize(
        (request.params as { id: string }).id,
        request.body as FinalizeContestEntryInput,
        actorId,
        mutationContext(request),
      );
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/contest-evidence/:id/access', { schema: contestEvidenceAccessRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    try {
      const data = await options.contestEntriesService.getEvidenceAccess((request.params as { id: string }).id);
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default contestEntriesRoutes;
