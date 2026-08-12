import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import {
  equipmentConditionRouteSchema,
  equipmentCreateRouteSchema,
  equipmentIdRouteSchema,
  equipmentListRouteSchema,
  equipmentUpdateRouteSchema,
} from '../../shared/http/schemas/equipment.schema.js';
import { authenticatedRouteSchema } from '../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { EquipmentService } from './equipment.service.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
};

export interface EquipmentRoutesOptions {
  equipmentService: EquipmentService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

function requestBody(request: FastifyRequest): Record<string, unknown> {
  return (request.body || {}) as Record<string, unknown>;
}

function changeReason(request: FastifyRequest, fallback: string): string {
  const value = request.headers['x-change-reason'];
  return typeof value === 'string' && value.trim().length >= 5 ? value.trim() : fallback;
}

const equipmentRoutes: FastifyPluginAsync<EquipmentRoutesOptions> = async (fastify, options) => {
  const actorIdFor = async (request: FastifyRequest): Promise<string | null> => {
    if (!options.equipmentService.repositoryIsConfigured()) return (request.user as JwtPayload).userId;
    return resolveDatabaseUserId(request.user as JwtPayload);
  };

  fastify.get('/api/equipment', {
    schema: equipmentListRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.read')],
  }, async (request, reply) => {
    try {
      const query = request.query as Record<string, string | undefined>;
      return reply.send({
        success: true,
        ...(await options.equipmentService.list({
          search: query.search,
          kategori: query.kategori,
          kondisi: query.kondisi,
          status: query.status,
          page: Number(query.page || 1),
          pageSize: Number(query.pageSize || 20),
        })),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/equipment/summary', {
    schema: authenticatedRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.read')],
  }, async (_request, reply) => {
    try {
      return reply.send(await options.equipmentService.summary());
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/equipment/:id', {
    schema: equipmentIdRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.read')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send(await options.equipmentService.findById(id));
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/equipment', {
    schema: equipmentCreateRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.manage')],
  }, async (request, reply) => {
    const actorId = await actorIdFor(request);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const data = await options.equipmentService.create(requestBody(request), actorId);
      await options.persistAuditLog(request, {
        action: 'INSERT',
        tableName: 'equipment',
        recordId: data.id,
        newValues: data as unknown as Record<string, unknown>,
        changeReason: changeReason(request, 'Menambahkan alat sinematografi baru'),
      });
      return reply.status(201).send(data);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.put('/api/equipment/:id', {
    schema: equipmentUpdateRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.manage')],
  }, async (request, reply) => {
    const actorId = await actorIdFor(request);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const { id } = request.params as { id: string };
      const data = await options.equipmentService.update(id, requestBody(request), actorId);
      await options.persistAuditLog(request, {
        action: 'UPDATE',
        tableName: 'equipment',
        recordId: id,
        newValues: data as unknown as Record<string, unknown>,
        changeReason: changeReason(request, 'Memperbarui data alat sinematografi'),
      });
      return reply.send(data);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.patch('/api/equipment/:id/condition', {
    schema: equipmentConditionRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.manage')],
  }, async (request, reply) => {
    const actorId = await actorIdFor(request);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const { id } = request.params as { id: string };
      const data = await options.equipmentService.updateCondition(id, requestBody(request), actorId);
      await options.persistAuditLog(request, {
        action: 'UPDATE',
        tableName: 'equipment',
        recordId: id,
        newValues: data as unknown as Record<string, unknown>,
        changeReason: changeReason(request, 'Memperbarui kondisi alat sinematografi'),
      });
      return reply.send(data);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.delete('/api/equipment/:id', {
    schema: equipmentIdRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.manage')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deletedId = await options.equipmentService.remove(id);
      await options.persistAuditLog(request, {
        action: 'DELETE',
        tableName: 'equipment',
        recordId: deletedId,
        changeReason: changeReason(request, 'Menghapus alat sinematografi'),
      });
      return reply.send({ success: true });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default equipmentRoutes;
