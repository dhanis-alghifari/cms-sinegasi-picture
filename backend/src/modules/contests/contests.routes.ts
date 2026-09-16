import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import {
  contestCreateRouteSchema,
  contestListRouteSchema,
  contestSubmissionRouteSchema,
  contestUpdateRouteSchema,
  contestWinRateRouteSchema,
} from '../../shared/http/schemas/contests.schema.js';
import { authenticatedRouteSchema } from '../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { getAuditRequestContext } from '../../middleware/auditMiddleware.js';
import { mapRequestFields } from '../../shared/http/request-field-mapping.js';
import { ContestsService } from './contests.service.js';
import type { ContestCreateInput, ContestListQuery, ContestSubmissionInput, ContestUpdateInput } from './contests.types.js';

type AuditInput = { action: string; tableName: string; recordId?: string | null; newValues?: Record<string, unknown> | null; changeReason: string };
export interface ContestsRoutesOptions { contestsService: ContestsService; persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>; }

function mutationReason(request: FastifyRequest, body: Record<string, unknown>): string {
  const header = request.headers['x-change-reason'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const bodyReason = body.change_reason ?? body.changeReason;
  return typeof bodyReason === 'string' ? bodyReason.trim() : '';
}

const contestScopes: Readonly<Record<string, string>> = {
  west_java: 'jawa_barat', national: 'nasional', general: 'umum',
};

const contestStatuses: Readonly<Record<string, string>> = {
  open: 'buka', judging: 'proses_penjurian', completed: 'selesai',
};

const contestLevels: Readonly<Record<string, string>> = { city: 'kota' };

const awardStatuses: Readonly<Record<string, string>> = {
  first_place: 'Juara 1', second_place: 'Juara 2', third_place: 'Juara 3', honorable_mention: 'Harapan', finalist: 'Finalis', participant: 'Peserta',
};

function contestInput(input: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRequestFields(input, {
    name: 'nama', contest_type: 'jenis', date: 'tanggal', result: 'hasil', contest_name: 'nama_lomba',
    organizer: 'penyelenggara', city: 'kota', scope: 'tingkat', event_year: 'tahun_event', description: 'deskripsi',
    film_title: 'judul_film', director_id: 'sutradara_id', video_url: 'link_video', certificate_url: 'sertifikat_url',
  });
  return {
    ...mapped,
    ...(typeof mapped.tingkat === 'string' ? { tingkat: contestScopes[mapped.tingkat] ?? mapped.tingkat } : {}),
    ...(typeof mapped.level === 'string' ? { level: contestLevels[mapped.level] ?? mapped.level } : {}),
    ...(typeof mapped.status === 'string' ? { status: contestStatuses[mapped.status] ?? mapped.status } : {}),
    ...(typeof mapped.award_status === 'string' ? { award_status: awardStatuses[mapped.award_status] ?? mapped.award_status } : {}),
  };
}

const contestsRoutes: FastifyPluginAsync<ContestsRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/contests', { schema: contestListRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      return reply.send({ success: true, ...(await options.contestsService.list(contestInput((request.query || {}) as Record<string, unknown>) as ContestListQuery)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/contests/summary', { schema: authenticatedRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (_request, reply) => {
    try {
      return reply.send({ success: true, ...(await options.contestsService.summary()) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/contests/win-rate', { schema: contestWinRateRouteSchema, preHandler: [authenticate, requireCapability('contests.read')] }, async (request, reply) => {
    try {
      const { year: tahun } = request.query as { year?: string };
      return reply.send({ success: true, ...(await options.contestsService.winRate(tahun)) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contests', { schema: contestCreateRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    const body = contestInput(request.body as Record<string, unknown>) as ContestCreateInput;
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestsService.repositoryIsConfigured()
        ? await resolveDatabaseUserId(user)
        : user.userId;
      const data = await options.contestsService.create(body, actorId);
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'contests', recordId: data.id,
        newValues: data as unknown as Record<string, unknown>,
        changeReason: String(request.headers['x-change-reason'] || body.change_reason || 'Menambahkan data lomba baru'),
      });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.put('/api/contests/:id', { schema: contestUpdateRouteSchema, preHandler: [authenticate, requireCapability('contests.manage')] }, async (request, reply) => {
    const body = contestInput(request.body as Record<string, unknown>) as ContestUpdateInput;
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestsService.repositoryIsConfigured()
        ? await resolveDatabaseUserId(user)
        : user.userId;
      const data = await options.contestsService.update(
        (request.params as { id: string }).id,
        body,
        actorId,
        mutationReason(request, body as unknown as Record<string, unknown>),
        getAuditRequestContext(request),
      );
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/contests/submissions', { schema: contestSubmissionRouteSchema, preHandler: [authenticate, requireCapability('contests.submit')] }, async (request, reply) => {
    const body = contestInput(request.body as Record<string, unknown>) as ContestSubmissionInput;
    try {
      const user = request.user as JwtPayload;
      const actorId = options.contestsService.repositoryIsConfigured()
        ? await resolveDatabaseUserId(user)
        : user.userId;
      const data = await options.contestsService.submit(body, actorId);
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: body.judul_film ? 'contest_submissions' : 'contest_films', recordId: data.id,
        newValues: data as unknown as Record<string, unknown>,
        changeReason: String(request.headers['x-change-reason'] || body.change_reason || 'Mendaftarkan film ke lomba'),
      });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default contestsRoutes;
