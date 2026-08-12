import type { FastifyPluginAsync } from 'fastify';

/** Public liveness endpoint. Keep this route free of database dependencies. */
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'service', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            service: { type: 'string' },
            webAppMode: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async () => ({
      status: 'ok',
      service: 'Sinegasi Fastify Backend',
      webAppMode: 'responsive-online-first',
      timestamp: new Date().toISOString(),
    }));
};

export default healthRoutes;
