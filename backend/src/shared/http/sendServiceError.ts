import type { FastifyReply } from 'fastify';

type ServiceErrorLike = {
  statusCode?: unknown;
  errorCode?: unknown;
  message?: unknown;
  details?: unknown;
};

/** Converts known service errors to the legacy HTTP envelope. Unknown errors bubble to Fastify. */
export function sendServiceError(error: unknown, reply: FastifyReply): unknown {
  const candidate = error as ServiceErrorLike | null;
  const statusCode = candidate && typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined;
  if (!statusCode) throw error;
  const message = candidate && typeof candidate.message === 'string' ? candidate.message : 'Permintaan tidak dapat diproses.';
  const errorCode = candidate && typeof candidate.errorCode === 'string' ? candidate.errorCode : 'REQUEST_FAILED';
  const requestId = reply.request.id;
  reply.header('X-Request-Id', requestId);
  reply.header('Cache-Control', 'no-store');
  const details = candidate?.details;
  if (statusCode === 429) {
    const resetAt = details && typeof details === 'object' && 'resets_at' in details
      ? Date.parse(String((details as { resets_at?: unknown }).resets_at))
      : Number.NaN;
    const retryAfter = Number.isFinite(resetAt) ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : 86400;
    reply.header('Retry-After', String(retryAfter));
  }
  return reply.status(statusCode).send({
    success: false,
    statusCode,
    error: errorCode,
    error_code: errorCode,
    message,
    request_id: requestId,
    ...(details === undefined ? {} : { details }),
  });
}
