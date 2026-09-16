import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { auditMiddleware } from '../middleware/auditMiddleware.js';
import { idempotencyMiddleware, saveIdempotencyResponse } from '../middleware/idempotencyMiddleware.js';
import { runtimeConfig } from '../config/env.js';
import { supabase } from '../services/supabaseClient.js';
import { ActorDirectory } from '../shared/actors/actors.repository.js';
import { collectActorIds, enrichActorReferences } from '../shared/actors/actors.enrichment.js';

type ErrorWithStatus = { statusCode?: number; name?: string };
type ValidationIssue = { keyword?: string; params?: { missingProperty?: string } };
type ValidationErrorLike = ErrorWithStatus & { validation?: ValidationIssue[] };

function publicErrorMessage(error: unknown): string {
  const validation = (error as ValidationErrorLike | null)?.validation;
  if (validation?.some((issue) => issue.keyword === 'required' && issue.params?.missingProperty === 'evidence_ids')) {
    return 'Foto kondisi wajib diunggah minimal 2 foto untuk setiap alat yang dikembalikan. Alat hilang tidak wajib difoto.';
  }
  const statusCode = Number((error as ErrorWithStatus | null)?.statusCode) || 500;
  if (statusCode === 400) return 'Permintaan tidak valid.';
  if (statusCode === 401) return 'Sesi tidak valid atau sudah berakhir.';
  if (statusCode === 403) return 'Anda tidak memiliki akses untuk melakukan tindakan ini.';
  if (statusCode === 404) return 'Data atau rute tidak ditemukan.';
  if (statusCode === 409) return 'Permintaan bentrok dengan perubahan terbaru. Silakan muat ulang data.';
  if (statusCode === 422) return 'Data yang dikirim belum valid.';
  return 'Terjadi kesalahan pada server. Silakan coba lagi.';
}

function applyCachePolicy(path: string, reply: FastifyReply): void {
  if (path === '/api/health') {
    reply.header('Cache-Control', 'no-store');
    return;
  }
  if (path.startsWith('/api/auth')) {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return;
  }
  if (path.startsWith('/api/notifications')) {
    reply.header('Cache-Control', 'private, no-store, must-revalidate');
    return;
  }
  if (path.startsWith('/api/options/kelas')) {
    reply.header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return;
  }
  const privateDataPrefixes = [
    '/api/students', '/api/grades', '/api/attendance', '/api/equipment',
    '/api/borrowing', '/api/borrowings', '/api/cash', '/api/contests',
    '/api/film-works', '/api/users', '/api/assignments', '/api/classes',
  ];
  if (privateDataPrefixes.some((prefix) => path.startsWith(prefix))) {
    reply.header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return;
  }
  reply.header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
}

type RouteConfig = {
  enrichActors?: boolean;
};

const actorDirectory = new ActorDirectory(supabase);

/** Installs cross-cutting request behavior shared by every feature plugin. */
export function registerAppHooks(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: unknown, request, reply) => {
    const statusCode = Number((error as ErrorWithStatus | null)?.statusCode) || 500;
    request.log.error({ err: error, requestId: request.id, statusCode }, 'Unhandled request error');
    reply.header('X-Request-Id', request.id);
    reply.status(statusCode).send({
      success: false,
      error: statusCode < 500 ? (error as ErrorWithStatus | null)?.name || 'RequestError' : 'ServerError',
      error_code: statusCode < 500 ? (error as ErrorWithStatus | null)?.name || 'REQUEST_ERROR' : 'SERVER_ERROR',
      message: publicErrorMessage(error),
      request_id: request.id,
    });
  });

  fastify.addHook('onRequest', auditMiddleware);
  fastify.addHook('onRequest', async (request) => {
    (request as FastifyRequest & { startedAtNs?: bigint }).startedAtNs = process.hrtime.bigint();
  });
  fastify.addHook('onResponse', async (request, reply) => {
    const startedAtNs = (request as FastifyRequest & { startedAtNs?: bigint }).startedAtNs;
    const durationMs = startedAtNs
      ? Number(process.hrtime.bigint() - startedAtNs) / 1_000_000
      : undefined;
    request.log.info({
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
      durationMs: durationMs === undefined ? undefined : Math.round(durationMs * 100) / 100,
    }, 'request completed');
  });
  fastify.addHook('preHandler', idempotencyMiddleware);
  fastify.addHook('preSerialization', async (request, _reply, payload) => {
    const config = request.routeOptions.config as RouteConfig | undefined;
    if (config?.enrichActors === false) return payload;

    const actorIds = collectActorIds(payload);
    if (actorIds.length === 0) return payload;

    // Identity hydration is best-effort. The persisted UUID and immutable
    // audit snapshots remain the source of truth if the directory is down.
    const actors = await actorDirectory.resolve(actorIds);
    return enrichActorReferences(payload, actors);
  });
  fastify.addHook('onSend', async (request, reply, payload) => {
    const path = request.url.split('?')[0];
    reply.header('X-Request-Id', request.id);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', "frame-ancestors 'none'");
    reply.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    if (runtimeConfig.environment === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    applyCachePolicy(path, reply);
    await saveIdempotencyResponse(request, reply.statusCode, payload);
    return payload;
  });
}
