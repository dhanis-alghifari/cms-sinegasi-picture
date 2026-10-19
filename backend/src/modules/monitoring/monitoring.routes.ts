import type { FastifyPluginAsync } from 'fastify';
import { performance } from 'node:perf_hooks';
import { authenticate } from '../../middleware/authMiddleware.js';
import {
  CLIENT_ERROR_CODES, CLIENT_ERROR_KINDS, logClientError, type ClientErrorReport,
} from '../../shared/monitoring/requestMonitoring.js';
import type { JwtPayload } from '../../shared/auth/auth.types.js';

const ALLOWED_FIELDS = new Set(['kind', 'code', 'release', 'requestId', 'statusCode']);

function isClientErrorReport(value: unknown): value is ClientErrorReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  if (Object.keys(report).some((key) => !ALLOWED_FIELDS.has(key))) return false;
  if (!CLIENT_ERROR_KINDS.includes(report.kind as ClientErrorReport['kind'])
    || !CLIENT_ERROR_CODES.includes(report.code as ClientErrorReport['code'])) return false;
  if (report.release !== undefined
    && (typeof report.release !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(report.release))) return false;
  if (report.requestId !== undefined
    && (typeof report.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(report.requestId))) return false;
  return report.statusCode === undefined
    || (typeof report.statusCode === 'number' && Number.isInteger(report.statusCode)
      && report.statusCode >= 400 && report.statusCode <= 599);
}

/** Lossy first-party diagnostics only; not a durable audit trail or auth rate limiter. */
const monitoringRoutes: FastifyPluginAsync = async (fastify) => {
  const accounts = new Map<string, number>();
  let windowStartedAt = performance.now();
  let reportsInWindow = 0;

  fastify.post<{ Body: ClientErrorReport }>('/api/monitoring/client-errors', {
    bodyLimit: 1_024,
    schema: { body: { type: 'object' } },
    validatorCompiler: () => (body: unknown) => isClientErrorReport(body)
      ? { value: body }
      : { error: new Error('Invalid diagnostic report') },
    preHandler: [authenticate],
    config: { disableIdempotencyCache: true, enrichActors: false },
  }, async (request, reply) => {
    const now = performance.now();
    if (now - windowStartedAt >= 60_000) {
      accounts.clear();
      reportsInWindow = 0;
      windowStartedAt = now;
    }
    const actorId = (request.user as JwtPayload).userId;
    const actorReports = accounts.get(actorId) ?? 0;
    if (reportsInWindow >= 60 || actorReports >= 5) {
      return reply.header('Retry-After', Math.max(1, Math.ceil((windowStartedAt + 60_000 - now) / 1_000)))
        .status(429).send({
          success: false, error_code: 'DIAGNOSTIC_LIMIT_REACHED',
          message: 'Laporan diagnostik dibatasi. Jangan mencoba ulang otomatis.', request_id: request.id,
        });
    }
    reportsInWindow += 1;
    accounts.set(actorId, actorReports + 1);
    logClientError(request, request.body);
    return reply.status(204).send();
  });
};

export default monitoringRoutes;
