import type { FastifyInstance, FastifyRequest } from 'fastify';
import { runtimeConfig } from '../../config/env.js';
import { supabase } from '../../services/supabaseClient.js';
import { AuthService } from '../../modules/auth/auth.service.js';
import { createAuthRepository } from '../../modules/auth/auth.repository.js';
import { createSupabaseLoginRateLimiter } from '../../modules/auth/loginRateLimiter.js';
import { AttendanceService } from '../../modules/attendance/attendance.service.js';
import { createAttendanceRepository } from '../../modules/attendance/attendance.repository.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import { createAuditRepository } from '../../modules/audit/audit.repository.js';
import { resolveDatabaseUserId } from '../../modules/auth/auth.identity.js';
import { OverdueService } from '../../modules/overdue/overdue.service.js';
import { createOverdueRepository } from '../../modules/overdue/overdue.repository.js';
import { createOverdueLogStore } from '../../modules/overdue/overdue.memory.js';
import type { OverdueLogger } from '../../modules/overdue/overdue.types.js';
import { BillingService } from '../../modules/billing/billing.service.js';
import { createBillingRepository } from '../../modules/billing/billing.repository.js';
import type { BillingLogger } from '../../modules/billing/billing.types.js';
import { configureIdempotencyStore, createSupabaseIdempotencyStore } from '../../middleware/idempotencyMiddleware.js';
import { getAuditRequestContext } from '../../middleware/auditMiddleware.js';
import type { JwtPayload } from '../../shared/auth/auth.types.js';
import type { AuditRouteInput, PersistAuditLog } from '../../shared/audit/audit-route.types.js';

export interface CoreDependencies {
  authService: AuthService;
  loginRateLimiter: ReturnType<typeof createSupabaseLoginRateLimiter>;
  attendanceService: AttendanceService;
  auditService: AuditService;
  persistAuditLog: PersistAuditLog;
  overdueService: OverdueService;
  billingService: BillingService;
}

/** Builds cross-cutting and scheduled-operation dependencies. */
export function createCoreDependencies(fastify: FastifyInstance): CoreDependencies {
  const authService = new AuthService(
    createAuthRepository(supabase),
    runtimeConfig.allowDevelopmentAuth,
  );
  const attendanceService = new AttendanceService(createAttendanceRepository(supabase));
  const auditRepository = createAuditRepository(supabase);
  const auditService = new AuditService(auditRepository);
  const persistAuditLog: PersistAuditLog = async (request: FastifyRequest, input: AuditRouteInput) => {
    const user = request.user as JwtPayload | undefined;
    const context = getAuditRequestContext(request);
    await auditRepository.persist({
      userId: user ? await resolveDatabaseUserId(user) : null,
      requestId: context?.requestId,
      operationId: context?.operationId,
      userAgent: context?.userAgent,
      source: 'api',
      warn: (payload, message) => fastify.log.warn(payload, message),
    }, input);
  };

  const overdueLogger: OverdueLogger = {
    info: (message) => fastify.log.info(message),
    warn: (payload, message) => fastify.log.warn(payload, message),
    error: (payload, message) => fastify.log.error(payload, message),
  };
  const overdueService = new OverdueService(
    createOverdueRepository(supabase),
    createOverdueLogStore(),
    overdueLogger,
  );

  const billingLogger: BillingLogger = {
    info: (payload, message) => message ? fastify.log.info(payload, message) : fastify.log.info(payload),
    warn: (payload, message) => message ? fastify.log.warn(payload, message) : fastify.log.warn(payload),
    error: (payload, message) => message ? fastify.log.error(payload, message) : fastify.log.error(payload),
  };
  const billingService = new BillingService(createBillingRepository(supabase), billingLogger);
  configureIdempotencyStore(createSupabaseIdempotencyStore(supabase));

  return {
    authService,
    loginRateLimiter: createSupabaseLoginRateLimiter(supabase),
    attendanceService,
    auditService,
    persistAuditLog,
    overdueService,
    billingService,
  };
}
