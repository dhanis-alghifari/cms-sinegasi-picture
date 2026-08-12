import crypto from 'crypto';
import { FastifyRequest } from 'fastify';

export interface AuditRequestContext {
  requestId: string;
  operationId: string;
  action: string;
  ipAddress: string;
  userAgent: string;
}

type RequestWithAuditContext = FastifyRequest & {
  auditContext?: AuditRequestContext;
};

/**
 * Captures request metadata only. The durable audit record is written by the
 * successful domain mutation/RPC, so failed requests cannot appear as edits.
 */
export async function auditMiddleware(request: FastifyRequest) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;

  const requestWithContext = request as RequestWithAuditContext;
  const requestId = crypto.randomUUID();
  // Fastify resolves request.ip according to its trusted-proxy setting. Never
  // trust a caller-controlled X-Forwarded-For header directly.
  const ipAddress = request.ip;

  requestWithContext.auditContext = {
    requestId,
    operationId: crypto.randomUUID(),
    action: request.method,
    ipAddress,
    userAgent: request.headers['user-agent'] || 'Sinegasi PWA/1.0',
  };
}

export function getAuditRequestContext(request: FastifyRequest): AuditRequestContext | undefined {
  return (request as RequestWithAuditContext).auditContext;
}
