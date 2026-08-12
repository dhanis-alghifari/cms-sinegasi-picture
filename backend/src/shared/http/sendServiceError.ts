import type { FastifyReply } from 'fastify';

type ServiceErrorLike = {
  statusCode?: unknown;
  errorCode?: unknown;
  message?: unknown;
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
  return reply.status(statusCode).send({
    success: false,
    statusCode,
    error: errorCode,
    error_code: errorCode,
    message,
    request_id: requestId,
  });
}
