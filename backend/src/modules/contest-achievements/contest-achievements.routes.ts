import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { contestAchievementListRouteSchema, contestAchievementRecordRouteSchema } from '../../shared/http/schemas/contest-achievements.schema.js';
import { ContestAchievementsService } from './contest-achievements.service.js';
import type { ContestAchievementListQuery, RecordContestResultInput } from './contest-achievements.types.js';

export interface ContestAchievementsRoutesOptions { contestAchievementsService: ContestAchievementsService; }

const contestAchievementsRoutes: FastifyPluginAsync<ContestAchievementsRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/contest-achievements', { schema: contestAchievementListRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      return reply.send({ success: true, ...(await options.contestAchievementsService.list((request.query || {}) as ContestAchievementListQuery)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contest-entries/:id/results', { schema: contestAchievementRecordRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestAchievementsService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
      const body = request.body as RecordContestResultInput;
      const headerKey = request.headers['x-idempotency-key'];
      const idempotencyKey = typeof headerKey === 'string' ? headerKey : body.idempotency_key;
      const data = await options.contestAchievementsService.record((request.params as { id: string }).id, { ...body, idempotency_key: idempotencyKey }, actorId);
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default contestAchievementsRoutes;
