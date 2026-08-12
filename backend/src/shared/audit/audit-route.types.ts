import type { FastifyRequest } from 'fastify';

/** HTTP-facing audit payload shared by mutation route plugins. */
export type AuditRouteInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
  metadata?: Record<string, unknown>;
};

export type PersistAuditLog = (request: FastifyRequest, input: AuditRouteInput) => Promise<void>;
