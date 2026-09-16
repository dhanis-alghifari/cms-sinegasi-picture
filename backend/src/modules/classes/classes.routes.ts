import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import {
  classCreateRouteSchema,
  classIdRouteSchema,
  classesListRouteSchema,
  classesOptionsRouteSchema,
  classUpdateRouteSchema,
} from '../../shared/http/schemas/classes.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { mapRequestFields } from '../../shared/http/request-field-mapping.js';
import { ClassesService } from './classes.service.js';
import type { ClassCreateInput, ClassUpdateInput } from './classes.types.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
};

export interface ClassesRoutesOptions {
  classesService: ClassesService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

function requestBody(request: FastifyRequest): Record<string, unknown> {
  return (request.body || {}) as Record<string, unknown>;
}

function changeReason(request: FastifyRequest, body: Record<string, unknown>, fallback: string): string {
  const header = request.headers['x-change-reason'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const value = body.change_reason;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

const classesRoutes: FastifyPluginAsync<ClassesRoutesOptions> = async (fastify, options) => {
  const actorIdFor = async (request: FastifyRequest): Promise<string | null> => {
    const user = request.user as JwtPayload;
    return options.classesService.repositoryIsConfigured() ? resolveDatabaseUserId(user) : user.userId;
  };

  fastify.get('/api/options/kelas', {
    schema: classesOptionsRouteSchema,
    config: { enrichActors: false },
  }, async (_request, reply) => {
    try {
      return reply.send({ success: true, data: await options.classesService.listActiveOptions() });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/admin/classes', {
    schema: classesListRouteSchema,
    preHandler: [authenticate, requireCapability('classes.read')],
  }, async (request, reply) => {
    try {
      const query = mapRequestFields(request.query as Record<string, unknown>, { level: 'tingkat' }) as {
        page?: string; pageSize?: string; search?: string; tingkat?: string; is_active?: string;
      };
      return reply.send({
        success: true,
        ...(await options.classesService.list({
          page: Number(query.page || 1),
          pageSize: Number(query.pageSize || 20),
          search: query.search,
          tingkat: query.tingkat,
          isActive: query.is_active && query.is_active !== 'all' ? query.is_active === 'true' : undefined,
        })),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/admin/classes', {
    schema: classCreateRouteSchema,
    preHandler: [authenticate, requireCapability('classes.manage')],
  }, async (request, reply) => {
    try {
      const body = mapRequestFields(requestBody(request), { name: 'nama_kelas', level: 'tingkat' });
      const data = await options.classesService.create(body as unknown as ClassCreateInput, await actorIdFor(request));
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'classes', recordId: data.id,
        newValues: data as unknown as Record<string, unknown>, changeReason: 'Membuat data kelas baru',
      });
      return reply.status(201).send({ success: true, data, message: 'Kelas berhasil ditambahkan' });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.put('/api/admin/classes/:id', {
    schema: classUpdateRouteSchema,
    preHandler: [authenticate, requireCapability('classes.manage')],
  }, async (request, reply) => {
    try {
      const body = mapRequestFields(requestBody(request), { name: 'nama_kelas', level: 'tingkat' });
      const data = await options.classesService.update(
        (request.params as { id: string }).id,
        body as unknown as ClassUpdateInput,
        await actorIdFor(request),
        changeReason(request, body, ''),
      );
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'classes', recordId: data.id,
        newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request, body, 'Memperbarui data kelas'),
      });
      return reply.send({ success: true, data, message: 'Kelas berhasil diperbarui' });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.delete('/api/admin/classes/:id', {
    schema: classIdRouteSchema,
    preHandler: [authenticate, requireCapability('classes.manage')],
  }, async (request, reply) => {
    try {
      const body = requestBody(request);
      const data = await options.classesService.deactivate(
        (request.params as { id: string }).id,
        await actorIdFor(request),
        changeReason(request, body, 'Menonaktifkan kelas master'),
      );
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'classes', recordId: data.id,
        newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request, body, 'Menonaktifkan kelas master'),
      });
      return reply.send({ success: true, message: 'Kelas berhasil dinonaktifkan' });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default classesRoutes;
