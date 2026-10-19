import type { FastifyInstance } from 'fastify';
import healthRoutes from '../../modules/health/health.routes.js';
import authRoutes from '../../modules/auth/auth.routes.js';
import attendanceRoutes from '../../modules/attendance/attendance.routes.js';
import auditRoutes from '../../modules/audit/audit.routes.js';
import overdueRoutes from '../../modules/overdue/overdue.routes.js';
import monitoringRoutes from '../../modules/monitoring/monitoring.routes.js';
import type { AppDependencies } from '../app.dependencies.js';

export async function registerCoreRoutes(
  fastify: FastifyInstance,
  dependencies: AppDependencies,
): Promise<void> {
  await fastify.register(healthRoutes);
  await fastify.register(monitoringRoutes);
  await fastify.register(authRoutes, {
    authService: dependencies.authService,
    loginRateLimiter: dependencies.loginRateLimiter,
  });
  await fastify.register(attendanceRoutes, {
    attendanceService: dependencies.attendanceService,
    requiresDatabaseUserId: dependencies.attendanceRequiresDatabaseUserId,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(auditRoutes, { auditService: dependencies.auditService });
  await fastify.register(overdueRoutes, { overdueService: dependencies.overdueService });
}
