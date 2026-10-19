import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload } from '../../shared/auth/auth.types.js';
import { authenticate } from '../../middleware/authMiddleware.js';
import { changePasswordRouteSchema, loginRouteSchema } from '../../shared/http/schemas/auth.schema.js';
import { authenticatedRouteSchema } from '../../shared/http/schemas/core.schema.js';
import { sendPrivateImageReference } from '../../shared/http/sendPrivateImageReference.js';
import { AuthService, AuthServiceError } from './auth.service.js';
import { getLoginRateLimitKeys, LOGIN_RATE_LIMIT_WINDOW_SECONDS, type LoginRateLimiter } from './loginRateLimiter.js';
import { markVerifiedMonitoringActor } from '../../shared/monitoring/requestMonitoring.js';

export interface AuthRoutesOptions {
  authService: AuthService;
  loginRateLimiter: LoginRateLimiter;
}

function sendServiceError(error: unknown, reply: FastifyReply): unknown {
  if (error instanceof AuthServiceError) {
    let clientError = error.errorCode;
    if (error.errorCode === 'INVALID_CREDENTIALS') clientError = 'Invalid credentials';
    if (error.errorCode === 'TOO_MANY_REQUESTS') clientError = 'Too Many Requests';
    if (error.errorCode === 'AUTHENTICATION_UNAVAILABLE') clientError = 'AuthenticationUnavailable';
    return reply.status(error.statusCode).send({
      success: false,
      error: clientError,
      message: error.message,
    });
  }
  throw error;
}

function sendLoginLimiterUnavailable(reply: FastifyReply): unknown {
  return reply.header('Retry-After', '5').status(503).send({
    success: false,
    error: 'AUTHENTICATION_UNAVAILABLE',
    message: 'Layanan login sementara tidak tersedia. Coba lagi sebentar.',
  });
}

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, options) => {
  const { authService, loginRateLimiter } = options;

  fastify.post('/api/auth/login', {
    schema: loginRouteSchema,
    config: { disableIdempotencyCache: true },
  }, async (request, reply) => {
    const body = (request.body || {}) as { username?: string; password?: string };
    const username = body.username?.trim();
    const password = body.password;
    if (!username || !password) {
      return reply.status(401).send({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Username atau password salah.',
      });
    }

    let rateKeys: readonly [string, string];
    try {
      rateKeys = getLoginRateLimitKeys(request.ip, username);
      const decisions = await Promise.all(rateKeys.map((key) => loginRateLimiter.isLimited(key)));
      if (decisions.some((decision) => typeof decision !== 'boolean')) return sendLoginLimiterUnavailable(reply);
      if (decisions.some((decision) => decision)) {
        return reply.header('Retry-After', String(LOGIN_RATE_LIMIT_WINDOW_SECONDS)).status(429).send({
          success: false,
          error: 'TOO_MANY_REQUESTS',
          message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.',
        });
      }
    } catch {
      return sendLoginLimiterUnavailable(reply);
    }

    try {
      const result = await authService.login(username, password);
      try {
        await Promise.all(rateKeys.map((key) => loginRateLimiter.clear(key)));
      } catch {
        return sendLoginLimiterUnavailable(reply);
      }
      const token = fastify.jwt.sign(result.payload, { expiresIn: '8h' });
      markVerifiedMonitoringActor(request, result.payload);
      return reply.send({ success: true, token, user: result.user });
    } catch (error) {
      if (error instanceof AuthServiceError && error.errorCode === 'INVALID_CREDENTIALS') {
        try {
          await Promise.all(rateKeys.map((key) => loginRateLimiter.recordFailure(key)));
        } catch {
          return sendLoginLimiterUnavailable(reply);
        }
      }
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/auth/me', { schema: authenticatedRouteSchema, preHandler: [authenticate] }, async (request, reply) => {
    try {
      const data = await authService.getSession(request.user as JwtPayload);
      return reply.send(data);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/auth/me/photo', {
    onRequest: async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store').header('X-Content-Type-Options', 'nosniff');
    },
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const photo = await authService.getOwnPhoto(request.user as JwtPayload);
      return sendPrivateImageReference(reply, photo, 1_500_000);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/auth/logout', { schema: authenticatedRouteSchema, preHandler: [authenticate] }, async (_request, reply) => {
    return reply.send({ success: true, message: 'Sesi berhasil diakhiri.' });
  });

  const changePasswordHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await authService.changePassword(
        request.user as JwtPayload,
        (request.body || {}) as Record<string, unknown>,
      );
      const token = fastify.jwt.sign(result.payload, { expiresIn: '8h' });
      return reply.send({
        success: true,
        token,
        user: result.user,
        message: result.message,
        userId: result.userId,
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  };

  fastify.post('/api/auth/change-password', {
    schema: changePasswordRouteSchema,
    preHandler: [authenticate],
  }, changePasswordHandler);
  fastify.patch('/api/auth/change-password', {
    schema: changePasswordRouteSchema,
    preHandler: [authenticate],
  }, changePasswordHandler);
};

export default authRoutes;
