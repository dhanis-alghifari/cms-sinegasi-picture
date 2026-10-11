import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { contestAchievementDetailRouteSchema, contestAchievementListRouteSchema, contestAchievementRecordRouteSchema } from '../../shared/http/schemas/contest-achievements.schema.js';
import { ContestAchievementsService, ContestAchievementsServiceError } from './contest-achievements.service.js';
import { mapRequestFields } from '../../shared/http/request-field-mapping.js';
import type { ContestAchievementListQuery } from './contest-achievements.types.js';

export interface ContestAchievementsRoutesOptions { contestAchievementsService: ContestAchievementsService; }

const contestAchievementsRoutes: FastifyPluginAsync<ContestAchievementsRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/contest-achievements', { schema: contestAchievementListRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      const query = mapRequestFields((request.query || {}) as Record<string, unknown>, { event_year: 'tahun_event' });
      return reply.send({ success: true, ...(await options.contestAchievementsService.list(query as ContestAchievementListQuery)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/contest-achievements/:id', { schema: contestAchievementDetailRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      const data = await options.contestAchievementsService.getDetail((request.params as { id: string }).id);
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contest-entries/:id/results', { schema: contestAchievementRecordRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    try {
      throw new ContestAchievementsServiceError(
        410,
        'CONTEST_RESULT_LEGACY_DISABLED',
        'Endpoint hasil lomba lama sudah tidak digunakan. Selesaikan pipeline karya melalui endpoint finalisasi.',
      );
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default contestAchievementsRoutes;
