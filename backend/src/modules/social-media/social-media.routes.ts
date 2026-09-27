import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate, requireAnyRole, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import type { PersistAuditLog } from '../../shared/audit/audit-route.types.js';
import {
  socialAccountCreateSchema, socialAccountUpdateSchema, socialAccountsListSchema,
  socialEvidenceAccessSchema, socialEvidenceCompleteSchema, socialEvidenceReserveSchema,
  socialInsightCreateSchema, socialInsightFinalizeSchema, socialMetricsQuerySchema,
  socialPublicationCreateSchema, socialPublicationFinalizeSchema, socialPublicationsListSchema,
  socialReportQuerySchema, socialSnapshotCreateSchema,
} from '../../shared/http/schemas/social-media.schema.js';
import { SocialMediaService } from './social-media.service.js';
import type { SocialEvidence } from './social-media.types.js';

export interface SocialMediaRoutesOptions {
  socialMediaService: SocialMediaService;
  persistAuditLog: PersistAuditLog;
}

function header(request: FastifyRequest, name: string): string {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function idempotencyKey(request: FastifyRequest): string { return header(request, 'x-idempotency-key'); }
function changeReason(request: FastifyRequest): string { return header(request, 'x-change-reason'); }

async function actorIdFor(request: FastifyRequest, service: SocialMediaService): Promise<string> {
  const user = request.user as JwtPayload;
  const actorId = service.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
  if (!actorId) throw Object.assign(new Error('Identitas akun belum terhubung ke data pengguna.'), { statusCode: 503, errorCode: 'SOCIAL_ACTOR_NOT_FOUND' });
  return actorId;
}

const socialMediaRoutes: FastifyPluginAsync<SocialMediaRoutesOptions> = async (fastify, options) => {
  const socialRead = [authenticate, requireCapability('social_media.read')];
  const publicationManage = [authenticate, requireCapability('social_media.publications.manage')];
  const metricsManage = [authenticate, requireCapability('social_media.metrics.manage')];
  const accountManage = [authenticate, requireAnyRole('teacher'), requireCapability('social_media.accounts.manage')];

  fastify.get('/api/social-media/accounts', { schema: socialAccountsListSchema, preHandler: socialRead }, async (request, reply) => {
    try {
      const includeInactive = (request.query as { include_inactive?: string })?.include_inactive === 'true';
      if (includeInactive && (request.user as JwtPayload).role !== 'teacher') {
        return reply.status(403).send({ success: false, error: 'FORBIDDEN', error_code: 'FORBIDDEN', message: 'Akun nonaktif hanya dapat dilihat oleh Guru Pembina.', request_id: request.id });
      }
      return reply.header('Cache-Control', 'no-store').send({ success: true, data: await options.socialMediaService.accounts(includeInactive) });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.post('/api/social-media/accounts', { schema: socialAccountCreateSchema, preHandler: accountManage }, async (request, reply) => {
    try {
      const body = request.body as { platform: 'instagram' | 'tiktok' | 'youtube' | 'whatsapp'; account_name: string; account_url: string };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const result = await options.socialMediaService.createAccount(body, actorId, idempotencyKey(request), changeReason(request));
      if (!result.idempotentReplay) await options.persistAuditLog(request, { action: 'INSERT', tableName: 'social_accounts', recordId: result.data.id, newValues: result.data as unknown as Record<string, unknown>, changeReason: changeReason(request) });
      return reply.status(result.idempotentReplay ? 200 : 201).send({ success: true, data: result.data, idempotent_replay: result.idempotentReplay });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.patch('/api/social-media/accounts/:id', { schema: socialAccountUpdateSchema, preHandler: accountManage }, async (request, reply) => {
    try {
      const body = request.body as { account_name?: string; account_url?: string; is_active?: boolean; expected_version: number };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const data = await options.socialMediaService.updateAccount((request.params as { id: string }).id, body, actorId, idempotencyKey(request), changeReason(request));
      await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'social_accounts', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request) });
      return reply.send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.get('/api/social-media/publications', { schema: socialPublicationsListSchema, preHandler: socialRead }, async (request, reply) => {
    try {
      const data = await options.socialMediaService.publications(request.query as { from?: string; to?: string; platform?: string; page?: string; pageSize?: string });
      return reply.header('Cache-Control', 'no-store').send({ success: true, ...data });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.post('/api/social-media/publications', { schema: socialPublicationCreateSchema, preHandler: publicationManage }, async (request, reply) => {
    try {
      const body = request.body as { social_account_id: string; content_type: string; caption: string; published_at: string; platform_url?: string; agenda_activity_id?: string; status?: 'draft' | 'recorded' };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const result = await options.socialMediaService.createPublication(body, actorId, idempotencyKey(request), changeReason(request));
      if (!result.idempotentReplay) await options.persistAuditLog(request, { action: 'INSERT', tableName: 'social_publications', recordId: result.data.id, newValues: result.data as unknown as Record<string, unknown>, changeReason: changeReason(request) });
      return reply.status(result.idempotentReplay ? 200 : 201).send({ success: true, data: result.data, idempotent_replay: result.idempotentReplay });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.patch('/api/social-media/publications/:id', { schema: socialPublicationFinalizeSchema, preHandler: publicationManage }, async (request, reply) => {
    try {
      const body = request.body as { status: 'recorded'; expected_version: number };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const data = await options.socialMediaService.finalizePublication((request.params as { id: string }).id, body.expected_version, actorId, idempotencyKey(request), changeReason(request));
      await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'social_publications', recordId: data.id, newValues: { status: data.status, version: data.version }, changeReason: changeReason(request) });
      return reply.send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });

  const evidenceRouteConfig = { disableIdempotencyCache: true };
  const reserveEvidence = (parentKind: 'publication' | 'insight_period') => async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { file_name: string; content_type: string; file_size_bytes: number };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const result = await options.socialMediaService.reserveEvidence(parentKind, (request.params as { id: string }).id, body, actorId, idempotencyKey(request), changeReason(request));
      const evidence = result.evidence as SocialEvidence;
      if (!result.idempotent_replay) await options.persistAuditLog(request, { action: 'INSERT', tableName: 'social_media_evidence', recordId: evidence.id, newValues: { id: evidence.id, upload_status: evidence.upload_status, mime_type: evidence.mime_type, file_size_bytes: evidence.file_size_bytes }, changeReason: changeReason(request) });
      return reply.header('Cache-Control', 'no-store').status(result.idempotent_replay ? 200 : 201).send({ success: true, data: result });
    } catch (error) { return sendServiceError(error, reply); }
  };
  const completeEvidence = (parentKind: 'publication' | 'insight_period') => async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { id: string; evidenceId: string };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const result = await options.socialMediaService.completeEvidence(parentKind, params.id, params.evidenceId, actorId, idempotencyKey(request), changeReason(request));
      if (!result.idempotent_replay) await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'social_media_evidence', recordId: params.evidenceId, newValues: { id: params.evidenceId, upload_status: 'attached' }, changeReason: changeReason(request) });
      return reply.header('Cache-Control', 'no-store').send({ success: true, data: result });
    } catch (error) { return sendServiceError(error, reply); }
  };
  const evidenceAccess = (parentKind: 'publication' | 'insight_period') => async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await options.socialMediaService.evidenceAccess(parentKind, (request.params as { id: string }).id);
      return reply.header('Cache-Control', 'no-store').send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  };

  fastify.post('/api/social-media/publications/:id/evidence-uploads', { schema: socialEvidenceReserveSchema, config: evidenceRouteConfig, preHandler: publicationManage }, reserveEvidence('publication'));
  fastify.post('/api/social-media/publications/:id/evidence-uploads/:evidenceId/complete', { schema: socialEvidenceCompleteSchema, config: evidenceRouteConfig, preHandler: publicationManage }, completeEvidence('publication'));
  fastify.get('/api/social-media/publications/:id/evidence-access', { schema: socialEvidenceAccessSchema, preHandler: socialRead }, evidenceAccess('publication'));

  fastify.post('/api/social-media/insight-periods/:id/evidence-uploads', { schema: socialEvidenceReserveSchema, config: evidenceRouteConfig, preHandler: metricsManage }, reserveEvidence('insight_period'));
  fastify.post('/api/social-media/insight-periods/:id/evidence-uploads/:evidenceId/complete', { schema: socialEvidenceCompleteSchema, config: evidenceRouteConfig, preHandler: metricsManage }, completeEvidence('insight_period'));
  fastify.get('/api/social-media/insight-periods/:id/evidence-access', { schema: socialEvidenceAccessSchema, preHandler: socialRead }, evidenceAccess('insight_period'));

  fastify.get('/api/social-media/metrics', { schema: socialMetricsQuerySchema, preHandler: socialRead }, async (request, reply) => {
    try {
      const query = request.query as { from?: string; to?: string };
      return reply.header('Cache-Control', 'no-store').send({ success: true, data: await options.socialMediaService.metrics(query.from, query.to) });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.post('/api/social-media/snapshots', { schema: socialSnapshotCreateSchema, preHandler: metricsManage }, async (request, reply) => {
    try {
      const body = request.body as { social_account_id: string; as_of_date: string; audience_count: number };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const result = await options.socialMediaService.createSnapshot(body, actorId, idempotencyKey(request), changeReason(request));
      if (!result.idempotentReplay) await options.persistAuditLog(request, { action: 'INSERT', tableName: 'social_account_snapshots', recordId: result.data.id, newValues: result.data as unknown as Record<string, unknown>, changeReason: changeReason(request) });
      return reply.status(result.idempotentReplay ? 200 : 201).send({ success: true, data: result.data, idempotent_replay: result.idempotentReplay });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.post('/api/social-media/insight-periods', { schema: socialInsightCreateSchema, preHandler: metricsManage }, async (request, reply) => {
    try {
      const body = request.body as { social_account_id: string; period_start: string; period_end: string; views?: number; reach?: number; interactions?: number; profile_visits?: number; published_count?: number; notes?: string };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const result = await options.socialMediaService.createInsightPeriod(body, actorId, idempotencyKey(request), changeReason(request));
      if (!result.idempotentReplay) await options.persistAuditLog(request, { action: 'INSERT', tableName: 'social_insight_periods', recordId: result.data.id, newValues: result.data as unknown as Record<string, unknown>, changeReason: changeReason(request) });
      return reply.status(result.idempotentReplay ? 200 : 201).send({ success: true, data: result.data, idempotent_replay: result.idempotentReplay });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.patch('/api/social-media/insight-periods/:id', { schema: socialInsightFinalizeSchema, preHandler: metricsManage }, async (request, reply) => {
    try {
      const body = request.body as { status: 'recorded'; expected_version: number };
      const actorId = await actorIdFor(request, options.socialMediaService);
      const data = await options.socialMediaService.updateInsightPeriod((request.params as { id: string }).id, body.expected_version, actorId, idempotencyKey(request), changeReason(request));
      await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'social_insight_periods', recordId: data.id, newValues: { status: data.status, version: data.version }, changeReason: changeReason(request) });
      return reply.send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });

  fastify.get('/api/social-media/reports', { schema: socialReportQuerySchema, preHandler: socialRead }, async (request, reply) => {
    try {
      const query = request.query as { from: string; to: string };
      return reply.header('Cache-Control', 'no-store').send({ success: true, data: await options.socialMediaService.reports(query.from, query.to) });
    } catch (error) { return sendServiceError(error, reply); }
  });
};

export default socialMediaRoutes;
