import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireAnyCapability, requireCapability } from '../../middleware/capabilities.js';
import {
  equipmentConditionRouteSchema,
  equipmentCreateRouteSchema,
  equipmentIdRouteSchema,
  equipmentListRouteSchema,
  equipmentReportRouteSchema,
  equipmentUpdateRouteSchema,
  equipmentValuationCreateRouteSchema,
  equipmentRecoveryListRouteSchema,
  equipmentRecoveryCreateRouteSchema,
  equipmentRecoveryRepairRouteSchema,
  equipmentRecoveryReplacementRouteSchema,
  equipmentChargeListRouteSchema,
  equipmentChargePaymentRouteSchema,
  equipmentChargeEvidenceUploadRouteSchema,
  equipmentChargePaymentEventRouteSchema,
  equipmentEvidenceAccessRouteSchema,
  equipmentChargeEvidenceListRouteSchema,
} from '../../shared/http/schemas/equipment.schema.js';
import { authenticatedRouteSchema } from '../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { mapRequestFields } from '../../shared/http/request-field-mapping.js';
import { EquipmentService } from './equipment.service.js';
import { EquipmentRecoveryService, EquipmentRecoveryServiceError } from './equipment.recovery.service.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
};

export interface EquipmentRoutesOptions {
  equipmentService: EquipmentService;
  equipmentRecoveryService?: EquipmentRecoveryService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

function requestBody(request: FastifyRequest): Record<string, unknown> {
  return (request.body || {}) as Record<string, unknown>;
}

function changeReason(request: FastifyRequest, fallback: string): string {
  const value = request.headers['x-change-reason'];
  return typeof value === 'string' && value.trim().length >= 5 ? value.trim() : fallback;
}

function queryBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

const equipmentCategories: Readonly<Record<string, string>> = {
  camera: 'Kamera', lens: 'Lensa', audio: 'Audio', lighting: 'Lighting', accessory: 'Aksesoris', other: 'Lainnya',
};

const equipmentConditions: Readonly<Record<string, string>> = {
  good: 'bagus', minor_damage: 'sedikit_kerusakan', damaged: 'rusak', severely_damaged: 'rusak_besar', under_repair: 'sedang_diperbaiki', lost: 'hilang',
};

const equipmentStatuses: Readonly<Record<string, string>> = {
  available: 'tersedia', borrowed: 'dipinjam', maintenance: 'maintenance',
};

function equipmentInput(input: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRequestFields(input, {
    equipment_code: 'kode_alat', name: 'nama_alat', category: 'kategori', condition: 'kondisi',
    storage_location: 'lokasi_penyimpanan', photo_urls: 'foto_urls', photo_url: 'foto_url',
    description: 'deskripsi', damage_notes: 'catatan_kerusakan',
  });
  return {
    ...mapped,
    ...(typeof mapped.kategori === 'string' ? { kategori: equipmentCategories[mapped.kategori] ?? mapped.kategori } : {}),
    ...(typeof mapped.kondisi === 'string' ? { kondisi: equipmentConditions[mapped.kondisi] ?? mapped.kondisi } : {}),
    ...(typeof mapped.status === 'string' ? { status: equipmentStatuses[mapped.status] ?? mapped.status } : {}),
  };
}

const equipmentRoutes: FastifyPluginAsync<EquipmentRoutesOptions> = async (fastify, options) => {
  const actorIdFor = async (request: FastifyRequest): Promise<string | null> => {
    if (!options.equipmentService.repositoryIsConfigured()) return (request.user as JwtPayload).userId;
    return resolveDatabaseUserId(request.user as JwtPayload);
  };

  fastify.get('/api/equipment', {
    schema: equipmentListRouteSchema,
    preHandler: [authenticate, requireAnyCapability('equipment.read', 'borrowing.manage')],
  }, async (request, reply) => {
    try {
      const query = equipmentInput(request.query as Record<string, unknown>) as Record<string, string | undefined>;
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

  fastify.get('/api/equipment/report', {
    schema: equipmentReportRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.read')],
  }, async (request, reply) => {
    try {
      const query = request.query as Record<string, unknown>;
      const scope = query.scope === 'all' || query.scope === 'attention' ? query.scope : 'filtered';
      const filters = scope === 'all' ? {} : equipmentInput(query);
      return reply.send({
        success: true,
        data: await options.equipmentService.report({
          search: typeof filters.search === 'string' ? filters.search : undefined,
          kategori: typeof filters.kategori === 'string' ? filters.kategori : undefined,
          kondisi: typeof filters.kondisi === 'string' ? filters.kondisi : undefined,
          status: typeof filters.status === 'string' ? filters.status : undefined,
          includeValuation: queryBoolean(query.include_valuation),
          includePhotos: queryBoolean(query.include_photos),
          attentionOnly: scope === 'attention',
          scope,
        }),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  if (options.equipmentRecoveryService) {
    const recoveryService = options.equipmentRecoveryService;
    fastify.get('/api/equipment/recovery-cases', {
      schema: equipmentRecoveryListRouteSchema,
      preHandler: [authenticate, requireAnyCapability('equipment.read', 'borrowing.manage')],
    }, async (request, reply) => {
      try {
        return reply.send({ success: true, data: await recoveryService.listCases(request.query as { equipment_id?: string; status?: string }) });
      } catch (error) { return sendServiceError(error, reply); }
    });

    fastify.post('/api/equipment/:id/recovery-cases', {
      schema: equipmentRecoveryCreateRouteSchema,
      preHandler: [authenticate, requireCapability('equipment.manage')],
    }, async (request, reply) => {
      const actorId = await actorIdFor(request);
      if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke database.' });
      try {
        const params = request.params as { id: string };
        const body = { ...requestBody(request), equipment_id: params.id };
        const data = await recoveryService.createCase(body, actorId);
        await options.persistAuditLog(request, { action: 'INSERT', tableName: 'equipment_recovery_cases', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request, 'Membuat tindak lanjut alat') });
        return reply.status(201).send({ success: true, data });
      } catch (error) { return sendServiceError(error, reply); }
    });

    fastify.post('/api/equipment/recovery-cases/:caseId/complete-repair', {
      schema: equipmentRecoveryRepairRouteSchema,
      preHandler: [authenticate, requireCapability('equipment.manage')],
    }, async (request, reply) => {
      const actorId = await actorIdFor(request);
      if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke database.' });
      try {
        const data = await recoveryService.completeRepair({ ...requestBody(request), case_id: (request.params as { caseId: string }).caseId }, actorId);
        await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'equipment_recovery_cases', recordId: (request.params as { caseId: string }).caseId, newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request, 'Menyelesaikan perbaikan alat') });
        return reply.send({ success: true, data });
      } catch (error) { return sendServiceError(error, reply); }
    });

    fastify.post('/api/equipment/recovery-cases/:caseId/register-replacement', {
      schema: equipmentRecoveryReplacementRouteSchema,
      preHandler: [authenticate, requireCapability('equipment.manage')],
    }, async (request, reply) => {
      const actorId = await actorIdFor(request);
      if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke database.' });
      try {
        const data = await recoveryService.registerReplacement({ ...requestBody(request), case_id: (request.params as { caseId: string }).caseId }, actorId);
        await options.persistAuditLog(request, { action: 'INSERT', tableName: 'equipment', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request, 'Mendaftarkan alat pengganti') });
        return reply.status(201).send({ success: true, data });
      } catch (error) { return sendServiceError(error, reply); }
    });

    fastify.get('/api/equipment/charges', {
      schema: equipmentChargeListRouteSchema,
      preHandler: [authenticate, requireAnyCapability('equipment.read', 'borrowing.manage')],
    }, async (request, reply) => {
      try { return reply.send({ success: true, data: await recoveryService.listCharges(request.query as { student_id?: string; status?: string }) }); }
      catch (error) { return sendServiceError(error, reply); }
    });

    fastify.patch('/api/equipment/charges/:id', {
      schema: equipmentChargePaymentRouteSchema,
      preHandler: [authenticate, requireCapability('equipment.manage')],
    }, async (request, reply) => {
      try {
        throw new EquipmentRecoveryServiceError(
          410,
          'CHARGE_PAYMENT_LEGACY_DISABLED',
          'Endpoint pembayaran lama sudah tidak digunakan. Unggah bukti lalu gunakan endpoint pembayaran baru.',
        );
      } catch (error) {
        return sendServiceError(error, reply);
      }
    });

    fastify.post('/api/equipment/charges/:id/evidence-uploads', {
      schema: equipmentChargeEvidenceUploadRouteSchema,
      preHandler: [authenticate, requireCapability('equipment.manage')],
    }, async (request, reply) => {
      const actorId = await actorIdFor(request);
      if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke database.' });
      try {
        const id = (request.params as { id: string }).id;
        return reply.status(201).send({ success: true, data: await recoveryService.reserveChargeEvidence(id, requestBody(request), actorId) });
      } catch (error) { return sendServiceError(error, reply); }
    });

    fastify.post('/api/equipment/charges/:id/payments', {
      schema: equipmentChargePaymentEventRouteSchema,
      preHandler: [authenticate, requireCapability('equipment.manage')],
    }, async (request, reply) => {
      const actorId = await actorIdFor(request);
      if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke database.' });
      try {
        const id = (request.params as { id: string }).id;
        const data = await recoveryService.recordChargePaymentEvent({ ...requestBody(request), settlement_id: id }, actorId);
        await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'equipment_charge_settlements', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request, 'Mencatat pembayaran tagihan alat') });
        return reply.status(201).send({ success: true, data });
      } catch (error) { return sendServiceError(error, reply); }
    });

    fastify.get('/api/equipment/charges/:id/evidence', {
      schema: equipmentChargeEvidenceListRouteSchema,
      preHandler: [authenticate, requireAnyCapability('equipment.read', 'borrowing.manage')],
    }, async (request, reply) => {
      try { return reply.send({ success: true, data: await recoveryService.listChargeEvidenceAccess((request.params as { id: string }).id) }); }
      catch (error) { return sendServiceError(error, reply); }
    });
  }

  if (options.equipmentRecoveryService) {
    fastify.get('/api/equipment/evidence/:evidenceId/access', {
      schema: equipmentEvidenceAccessRouteSchema,
      preHandler: [authenticate, requireCapability('equipment.read')],
    }, async (request, reply) => {
      try { return reply.send({ success: true, data: await options.equipmentRecoveryService!.getChargeEvidenceAccess((request.params as { evidenceId: string }).evidenceId) }); }
      catch (error) { return sendServiceError(error, reply); }
    });
  }

  fastify.get('/api/equipment/:id/valuations', {
    schema: equipmentIdRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.read')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send({ success: true, data: await options.equipmentService.listValuations(id) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/equipment/:id/valuations', {
    schema: equipmentValuationCreateRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.manage')],
  }, async (request, reply) => {
    const actorId = await actorIdFor(request);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const { id } = request.params as { id: string };
      const data = await options.equipmentService.createValuation(id, requestBody(request), actorId, changeReason(request, 'Memperbarui nilai penggantian alat'));
      await options.persistAuditLog(request, { action: 'INSERT', tableName: 'equipment_valuations', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: changeReason(request, 'Memperbarui nilai penggantian alat') });
      return reply.status(201).send({ success: true, data });
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
      const data = await options.equipmentService.create(equipmentInput(requestBody(request)), actorId);
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
      const data = await options.equipmentService.update(
        id,
        equipmentInput(requestBody(request)),
        actorId,
        changeReason(request, 'Memperbarui data alat sinematografi'),
      );
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
      const data = await options.equipmentService.updateCondition(
        id,
        equipmentInput(requestBody(request)),
        actorId,
        changeReason(request, 'Memperbarui kondisi alat sinematografi'),
      );
      return reply.send(data);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.delete('/api/equipment/:id', {
    schema: equipmentIdRouteSchema,
    preHandler: [authenticate, requireCapability('equipment.manage')],
  }, async (request, reply) => {
    const actorId = await actorIdFor(request);
    if (!actorId) return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    try {
      const { id } = request.params as { id: string };
      await options.equipmentService.remove(
        id,
        actorId,
        changeReason(request, 'Menghapus alat sinematografi'),
      );
      return reply.send({ success: true });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default equipmentRoutes;
