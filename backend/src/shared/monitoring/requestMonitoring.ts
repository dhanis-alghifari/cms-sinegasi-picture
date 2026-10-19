import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { USER_ROLE_VALUES, type UserRole } from '../auth/auth.types.js';

export const CLIENT_ERROR_KINDS = ['render', 'runtime', 'unhandled_rejection', 'api'] as const;
export const CLIENT_ERROR_CODES = [
  'RENDER_ERROR', 'RUNTIME_ERROR', 'UNHANDLED_REJECTION', 'API_ERROR', 'NETWORK_ERROR',
] as const;

export interface ClientErrorReport {
  kind: typeof CLIENT_ERROR_KINDS[number];
  code: typeof CLIENT_ERROR_CODES[number];
  release?: string;
  requestId?: string;
  statusCode?: number;
}

interface VerifiedActor {
  actorId: string;
  role: UserRole;
}

const verifiedActors = new WeakMap<FastifyRequest, VerifiedActor>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const TELEMETRY_ROUTE = '/api/monitoring/client-errors';

/** Called only after the existing authentication seam has verified identity. */
export function markVerifiedMonitoringActor(request: FastifyRequest, user: { userId: string; role: UserRole }): void {
  if (!UUID_PATTERN.test(user.userId) || !USER_ROLE_VALUES.includes(user.role)) return;
  verifiedActors.set(request, { actorId: user.userId, role: user.role });
}

function requestFields(request: FastifyRequest): { requestId: string; method: string; route: string } {
  const route = request.routeOptions.url;
  return {
    requestId: request.id,
    method: METHODS.has(request.method) ? request.method : 'OTHER',
    // Never substitute request.url: it contains user-controlled IDs and query strings.
    route: route && /^\/[A-Za-z0-9_:/.*-]{0,159}$/.test(route) ? route : '/api/_unmatched',
  };
}

export function logClientError(request: FastifyRequest, report: ClientErrorReport): void {
  const actor = verifiedActors.get(request);
  if (!actor) return;
  request.log.warn({
    event: 'monitoring.client_error',
    eventId: randomUUID(),
    ...requestFields(request),
    ...actor,
    statusCode: 204,
    source: 'client_report',
    kind: report.kind,
    code: report.code,
    // Do not retain arbitrary build labels or caller-supplied correlation text.
    clientRequestId: report.requestId && UUID_PATTERN.test(report.requestId) ? report.requestId : undefined,
    clientStatusCode: report.statusCode,
  }, 'Browser error reported');
}

function loginOutcome(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode === 401) return 'invalid_credentials';
  if (statusCode === 429) return 'rate_limited';
  if (statusCode === 503) return 'unavailable';
  return statusCode >= 500 ? 'error' : 'rejected';
}

function apiErrorCode(statusCode: number): string {
  if (statusCode >= 500) return 'HTTP_5XX';
  if (statusCode === 403) return 'FORBIDDEN';
  return 'RATE_LIMITED';
}

/** Process-local sampling state is bounded; these events mean recent activity, not online presence. */
export function registerMonitoringHooks(fastify: FastifyInstance, now: () => number = () => performance.now()): void {
  const startedAt = new WeakMap<FastifyRequest, bigint>();
  const lastActivity = new Map<string, number>();
  const activityIntervalMs = 60_000;
  const maxActivityActors = 1_000;

  fastify.addHook('onRequest', async (request) => {
    startedAt.set(request, process.hrtime.bigint());
  });
  fastify.addHook('onResponse', async (request, reply) => {
    const fields = { ...requestFields(request), statusCode: reply.statusCode };
    const actor = verifiedActors.get(request);
    const start = startedAt.get(request);
    const durationMs = start === undefined ? undefined : Number(process.hrtime.bigint() - start) / 1_000_000;
    request.log.info({
      ...fields,
      durationMs: durationMs === undefined ? undefined : Math.round(durationMs * 100) / 100,
    }, 'request completed');

    if (fields.route === '/api/auth/login' && request.method === 'POST') {
      const event = {
        event: 'monitoring.login', eventId: randomUUID(), ...fields,
        outcome: loginOutcome(reply.statusCode),
        ...(reply.statusCode >= 200 && reply.statusCode < 300 ? actor : undefined),
      };
      if (reply.statusCode >= 400) request.log.warn(event, 'Login attempt completed');
      else request.log.info(event, 'Login attempt completed');
    }

    // Collector rejection is not a new application error; do not amplify telemetry loops.
    if (fields.route !== TELEMETRY_ROUTE
      && (reply.statusCode >= 500 || reply.statusCode === 403 || reply.statusCode === 429)) {
      const event = {
        event: 'monitoring.api_error', eventId: randomUUID(), ...fields, ...actor,
        code: apiErrorCode(reply.statusCode),
      };
      if (reply.statusCode >= 500) request.log.error(event, 'API request failed');
      else request.log.warn(event, 'API request rejected');
    }

    if (!actor || request.method === 'OPTIONS' || fields.route === TELEMETRY_ROUTE
      || reply.statusCode === 401 || reply.statusCode >= 500) return;
    const time = now();
    if (time - (lastActivity.get(actor.actorId) ?? Number.NEGATIVE_INFINITY) < activityIntervalMs) return;
    if (!lastActivity.has(actor.actorId) && lastActivity.size >= maxActivityActors) {
      for (const [actorId, observedAt] of lastActivity) {
        if (time - observedAt >= activityIntervalMs) lastActivity.delete(actorId);
      }
      // Saturation drops optional activity sampling, never authorization or a business request.
      if (lastActivity.size >= maxActivityActors) return;
    }
    lastActivity.set(actor.actorId, time);
    request.log.info({
      event: 'monitoring.activity', eventId: randomUUID(), ...fields, ...actor,
    }, 'Authenticated account activity observed');
  });
}
