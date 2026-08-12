import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { overdueCheckRouteSchema } from '../../shared/http/schemas/overdue.schema.js';
import { OverdueService } from './overdue.service.js';

export interface OverdueRoutesOptions {
  overdueService: OverdueService;
}

const overdueRoutes: FastifyPluginAsync<OverdueRoutesOptions> = async (fastify, options) => {
  fastify.post('/api/admin/overdue-check', {
    schema: overdueCheckRouteSchema,
    preHandler: [authenticate, requireCapability('overdue.manage')],
  }, async (_request, reply) => {
    const report = await options.overdueService.runManualCheck();
    return reply.send({
      success: true,
      message: `SYSTEM:OVERDUE_CHECK selesai. ${report.result.overdueCount} peminjaman telat ditemukan, ${report.result.notifiedCount} notifikasi dikirim.`,
      result: report.result,
      logs: report.logs,
    });
  });
};

export default overdueRoutes;
