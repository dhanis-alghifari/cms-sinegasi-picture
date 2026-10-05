import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import {
  API_RATE_LIMIT_POLICIES,
  getApiRateLimitKey,
  getApiRateLimitPolicies,
  type ApiRateLimitDecision,
  type ApiRateLimitPolicy,
  type ApiRateLimitStore,
} from './apiRateLimit.js';

function isApiRequest(request: FastifyRequest): boolean {
  if (request.method === 'OPTIONS') return false;
  const path = request.url.split('?')[0];
  return (path === '/api' || path.startsWith('/api/')) && path !== '/api/health';
}

function applyRateHeaders(reply: FastifyReply, decision: ApiRateLimitDecision): void {
  reply.header('X-RateLimit-Limit', decision.limit);
  reply.header('X-RateLimit-Remaining', decision.remaining);
  reply.header('X-RateLimit-Reset', Math.ceil(decision.resetAt / 1_000));
}

/** Register before routes and the authorized idempotency hook. Authentication stays the trusted seam. */
export function registerApiRateLimitHooks(fastify: FastifyInstance, options: {
  store: ApiRateLimitStore;
  authenticate: preHandlerHookHandler;
  now?: () => number;
}): void {
  const now = options.now ?? Date.now;

  async function enforce(
    request: FastifyRequest,
    reply: FastifyReply,
    principal: string,
    policies: readonly ApiRateLimitPolicy[],
  ): Promise<void> {
    for (const policy of policies) {
      let decision: ApiRateLimitDecision;
      try {
        decision = await options.store.consume(getApiRateLimitKey(principal, policy), policy);
      } catch {
        reply.header('Retry-After', 5);
        reply.status(503).send({
          success: false,
          error: 'RATE_LIMIT_UNAVAILABLE',
          error_code: 'RATE_LIMIT_UNAVAILABLE',
          message: 'Pemeriksaan keamanan sedang tidak tersedia. Silakan coba lagi sebentar.',
          request_id: request.id,
        });
        return;
      }
      applyRateHeaders(reply, decision);
      if (!decision.allowed) {
        reply.header('Retry-After', Math.max(1, Math.ceil((decision.resetAt - now()) / 1_000)));
        reply.status(429).send({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          error_code: 'RATE_LIMIT_EXCEEDED',
          message: 'Permintaan terlalu sering. Tunggu sebentar sebelum mencoba lagi.',
          request_id: request.id,
        });
        return;
      }
    }
  }

  fastify.addHook('onRequest', async (request, reply) => {
    if (!isApiRequest(request)) return;
    const policies: ApiRateLimitPolicy[] = [API_RATE_LIMIT_POLICIES.ip];
    if (request.routeOptions.url === '/api/auth/login') policies.push(API_RATE_LIMIT_POLICIES.loginIp);
    await enforce(request, reply, `ip:${request.ip}`, policies);
  });

  const accountHook: preHandlerHookHandler = async (request, reply) => {
    if (!isApiRequest(request) || reply.sent) return;
    const user = request.user as { userId?: unknown } | undefined;
    // This hook is inserted after authenticate, never after merely decoding a JWT.
    if (typeof user?.userId !== 'string' || user.userId.length === 0) {
      reply.status(401).send({ success: false, error_code: 'UNAUTHORIZED', message: 'Sesi tidak valid.' });
      return;
    }
    await enforce(request, reply, `account:${user.userId}`,
      getApiRateLimitPolicies(request.method, request.routeOptions.url ?? '/api/_unmatched'));
  };

  fastify.addHook('onRoute', (route) => {
    if (!route.preHandler) return;
    const hooks = Array.isArray(route.preHandler) ? [...route.preHandler] : [route.preHandler];
    const authenticationIndex = hooks.indexOf(options.authenticate);
    if (authenticationIndex < 0 || hooks.includes(accountHook)) return;
    hooks.splice(authenticationIndex + 1, 0, accountHook);
    route.preHandler = hooks;
  });
}
