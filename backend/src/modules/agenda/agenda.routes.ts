import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { getAuditRequestContext } from '../../middleware/auditMiddleware.js';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { agendaArchiveRouteSchema, agendaCreateRouteSchema, agendaDetailRouteSchema, agendaListRouteSchema, agendaPhotoAccessRouteSchema, agendaPhotoCompleteRouteSchema, agendaPhotoReserveRouteSchema, agendaUpdateRouteSchema } from '../../shared/http/schemas/agenda.schema.js';
import { AgendaService, AgendaServiceError } from './agenda.service.js';
import type { AgendaCreateInput, AgendaPhotoReserveInput, AgendaUpdateInput } from './agenda.types.js';

export interface AgendaRoutesOptions { agendaService: AgendaService; }

function context(request: FastifyRequest) {
  const audit = getAuditRequestContext(request);
  return { requestId: audit?.requestId, operationId: audit?.operationId, userAgent: audit?.userAgent || request.headers['user-agent'] };
}

function idempotencyKey(request: FastifyRequest, body?: Record<string, unknown>): string {
  const header = request.headers['x-idempotency-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return typeof body?.idempotency_key === 'string' ? body.idempotency_key : '';
}

async function actorIdFor(request: FastifyRequest, service: AgendaService): Promise<string> {
  const user = request.user as JwtPayload;
  const actorId = service.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
  if (!actorId) throw new AgendaServiceError(401, 'AGENDA_ACTOR_NOT_FOUND', 'Identitas akun belum terhubung ke data pengguna.');
  return actorId;
}

const agendaRoutes: FastifyPluginAsync<AgendaRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/agenda', { schema: agendaListRouteSchema, preHandler: [authenticate, requireCapability('agenda.read')] }, async (request, reply) => {
    try { return reply.send({ success: true, ...(await options.agendaService.list((request.query || {}) as Record<string, string>)) }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/agenda/report', { schema: agendaListRouteSchema, preHandler: [authenticate, requireCapability('agenda.read')] }, async (request, reply) => {
    try {
      const query = { ...((request.query || {}) as Record<string, string>), page: '1', pageSize: '100' };
      const data = await options.agendaService.report(query);
      return reply.send({ success: true, ...data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/agenda/:id', { schema: agendaDetailRouteSchema, preHandler: [authenticate, requireCapability('agenda.read')] }, async (request, reply) => {
    try { return reply.send({ success: true, data: await options.agendaService.get((request.params as { id: string }).id) }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/agenda', { schema: agendaCreateRouteSchema, preHandler: [authenticate, requireCapability('agenda.write')] }, async (request, reply) => {
    try {
      const actorId = await actorIdFor(request, options.agendaService);
      const data = await options.agendaService.create({ ...(request.body as AgendaCreateInput), idempotency_key: idempotencyKey(request, request.body as Record<string, unknown>) }, actorId, context(request));
      return reply.status(data.idempotentReplay ? 200 : 201).send({ success: true, data: data.data, idempotent_replay: data.idempotentReplay });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.patch('/api/agenda/:id', { schema: agendaUpdateRouteSchema, preHandler: [authenticate, requireCapability('agenda.write')] }, async (request, reply) => {
    try {
      const body = request.body as AgendaUpdateInput;
      const actorId = await actorIdFor(request, options.agendaService);
      const data = await options.agendaService.update((request.params as { id: string }).id, { ...body, idempotency_key: idempotencyKey(request, body as unknown as Record<string, unknown>) }, actorId, context(request));
      return reply.send({ success: true, data: data.data, idempotent_replay: data.idempotentReplay });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.delete('/api/agenda/:id', { schema: agendaArchiveRouteSchema, preHandler: [authenticate, requireCapability('agenda.archive')] }, async (request, reply) => {
    try {
      const body = request.body as { change_reason: string; idempotency_key?: string };
      const actorId = await actorIdFor(request, options.agendaService);
      const data = await options.agendaService.archive((request.params as { id: string }).id, body.change_reason, actorId, idempotencyKey(request, body as unknown as Record<string, unknown>), context(request));
      return reply.send({ success: true, data: data.data, idempotent_replay: data.idempotentReplay });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/agenda/:id/photo-uploads', { schema: agendaPhotoReserveRouteSchema, preHandler: [authenticate, requireCapability('agenda.write')] }, async (request, reply) => {
    try {
      const body = request.body as AgendaPhotoReserveInput;
      const actorId = await actorIdFor(request, options.agendaService);
      const data = await options.agendaService.reservePhoto((request.params as { id: string }).id, { ...body, idempotency_key: idempotencyKey(request, body as unknown as Record<string, unknown>) }, actorId);
      return reply.status(201).send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/agenda/:id/photo-uploads/:photoId/complete', { schema: agendaPhotoCompleteRouteSchema, preHandler: [authenticate, requireCapability('agenda.write')] }, async (request, reply) => {
    try {
      const actorId = await actorIdFor(request, options.agendaService);
      const params = request.params as { id: string; photoId: string };
      const data = await options.agendaService.completePhoto(params.id, params.photoId, actorId, idempotencyKey(request));
      return reply.send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/agenda/:id/photo-access', { schema: agendaPhotoAccessRouteSchema, preHandler: [authenticate, requireCapability('agenda.read')] }, async (request, reply) => {
    try { return reply.send({ success: true, data: await options.agendaService.photoAccess((request.params as { id: string }).id) }); } catch (error) { return sendServiceError(error, reply); }
  });
};

export default agendaRoutes;
