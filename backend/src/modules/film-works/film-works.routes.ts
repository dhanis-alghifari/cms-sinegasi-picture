import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { filmWorksListRouteSchema } from '../../shared/http/schemas/film-works.schema.js';
import { FilmWorksService, FilmWorksServiceError } from './film-works.service.js';

export interface FilmWorksRoutesOptions { filmWorksService: FilmWorksService; }

const filmWorksRoutes: FastifyPluginAsync<FilmWorksRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/film-works', { schema: filmWorksListRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      const { status } = request.query as { status?: string };
      const data = await options.filmWorksService.list(status);
      return reply.send({ success: true, total: data.length, data });
    } catch (error) {
      if (error instanceof FilmWorksServiceError) return reply.status(error.statusCode).send({ statusCode: error.statusCode, message: error.message });
      throw error;
    }
  });
};

export default filmWorksRoutes;
