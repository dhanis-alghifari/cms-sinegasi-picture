import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireAnyCapability, type Capability } from '../../middleware/capabilities.js';
import { readR2PrivateImage } from '../../services/cloudflareR2Service.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { PRIVATE_MEDIA_KINDS, type PrivateMediaKind, type PrivateMediaObject } from '../../shared/uploads/privateMedia.js';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import type { AgendaService } from '../agenda/agenda.service.js';
import type { ContestEntriesService } from '../contest-entries/contest-entries.service.js';
import type { BorrowingMutationsService } from '../borrowing/borrowing.mutations.service.js';
import type { EquipmentRecoveryService } from '../equipment/equipment.recovery.service.js';
import type { SocialMediaService } from '../social-media/social-media.service.js';

export interface PrivateMediaRoutesOptions {
  agendaService: Pick<AgendaService, 'photoMedia'>;
  contestEntriesService: Pick<ContestEntriesService, 'evidenceMedia'>;
  borrowingMutationsService: Pick<BorrowingMutationsService, 'returnEvidenceMedia' | 'repositoryIsConfigured'>;
  equipmentRecoveryService: Pick<EquipmentRecoveryService, 'chargeEvidenceMedia'>;
  socialMediaService: Pick<SocialMediaService, 'evidenceMedia'>;
  readImage?: typeof readR2PrivateImage;
}

const capabilities: Record<PrivateMediaKind, readonly Capability[]> = {
  agenda: ['agenda.read'], contest: ['contests.read'], return: ['borrowing.manage'],
  'return-report': ['borrowing.read'], charge: ['equipment.read', 'borrowing.manage'],
  publication: ['social_media.read'], insight: ['social_media.read'],
};
const idSchema = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' } as const;
const privateMediaSchema = {
  params: { type: 'object', additionalProperties: false, required: ['kind', 'parentId', 'id'], properties: {
    kind: { type: 'string', enum: PRIVATE_MEDIA_KINDS }, parentId: idSchema, id: idSchema,
  } },
  querystring: { type: 'object', additionalProperties: false, maxProperties: 0 },
} as const;

/** The caller chooses resource IDs only. Every request repeats the domain lookup. */
export const privateMediaRoutes: FastifyPluginAsync<PrivateMediaRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/private-media/:kind/:parentId/:id', {
    schema: privateMediaSchema,
    preHandler: [authenticate, async (request, reply) => {
      const { kind } = request.params as { kind: PrivateMediaKind };
      await requireAnyCapability(...capabilities[kind])(request, reply);
    }],
  }, async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store').header('Vary', 'Authorization')
      .header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer');
    const { kind, parentId, id } = request.params as { kind: PrivateMediaKind; parentId: string; id: string };
    const user = request.user as JwtPayload;
    try {
      let object: PrivateMediaObject;
      switch (kind) {
        case 'agenda': object = await options.agendaService.photoMedia(parentId, id); break;
        case 'contest': object = await options.contestEntriesService.evidenceMedia(parentId, id); break;
        case 'return': object = await options.borrowingMutationsService.returnEvidenceMedia(parentId, id); break;
        case 'return-report': {
          const actorId = user.role === 'teacher' ? null : options.borrowingMutationsService.repositoryIsConfigured()
            ? await resolveDatabaseUserId(user) : user.userId;
          object = await options.borrowingMutationsService.returnEvidenceMedia(parentId, id, { teacher: user.role === 'teacher', id: actorId });
          break;
        }
        case 'charge': object = await options.equipmentRecoveryService.chargeEvidenceMedia(parentId, id); break;
        case 'publication': object = await options.socialMediaService.evidenceMedia('publication', parentId, id); break;
        case 'insight': object = await options.socialMediaService.evidenceMedia('insight_period', parentId, id); break;
      }
      let image: Awaited<ReturnType<typeof readR2PrivateImage>>;
      try { image = await (options.readImage ?? readR2PrivateImage)(object); }
      catch { return reply.status(503).send({ success: false, error_code: 'PRIVATE_MEDIA_UNAVAILABLE', message: 'File privat sedang tidak tersedia.' }); }
      return reply.type(image.contentType).header('Content-Disposition', 'inline').send(image.body);
    } catch (error) { return sendServiceError(error, reply); }
  });
};
