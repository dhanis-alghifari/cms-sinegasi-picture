import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import {
  authenticate,
  clearAuthStateCache,
  type JwtPayload,
} from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import {
  studentCreateRouteSchema,
  studentIdRouteSchema,
  studentProvisionRouteSchema,
  studentsListRouteSchema,
  studentsOptionsRouteSchema,
  studentUpdateRouteSchema,
} from '../../shared/http/schemas/students.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { StudentNotFoundError, StudentService } from './students.service.js';
import type { StudentCreateInput, StudentUpdateInput } from './students.types.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
  metadata?: Record<string, unknown>;
};

export interface StudentRoutesOptions {
  studentsService: StudentService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

function bodyOf(request: FastifyRequest): Record<string, unknown> {
  return (request.body || {}) as Record<string, unknown>;
}

function reasonFrom(request: FastifyRequest, body: Record<string, unknown>, fallback: string): string {
  const header = request.headers['x-change-reason'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const value = body.change_reason ?? body.changeReason;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

const studentRoutes: FastifyPluginAsync<StudentRoutesOptions> = async (fastify, options) => {
  const actorIdFor = async (request: FastifyRequest): Promise<string | null> => {
    const user = request.user as JwtPayload;
    return options.studentsService.repositoryIsConfigured() ? resolveDatabaseUserId(user) : user.userId;
  };

  fastify.get('/api/students/options', {
    schema: studentsOptionsRouteSchema,
    preHandler: [authenticate, requireCapability('students.read')],
  }, async (request, reply) => {
    try {
      const query = request.query as { q?: string; limit?: string; active?: string };
      return reply.send({
        success: true,
        ...(await options.studentsService.listOptions({
          search: query.q,
          limit: Number(query.limit || 20),
          isActive: query.active === undefined ? true : query.active === 'true',
        })),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/students', {
    schema: studentsListRouteSchema,
    preHandler: [authenticate, requireCapability('students.read')],
  }, async (request, reply) => {
    try {
      const query = request.query as { search?: string; kelas?: string; peminatan?: string; is_active?: string; page?: string; pageSize?: string };
      return reply.send({
        success: true,
        ...(await options.studentsService.list({
          search: query.search,
          kelas: query.kelas,
          peminatan: query.peminatan,
          isActive: query.is_active && query.is_active !== 'all' ? query.is_active === 'true' : undefined,
          page: Number(query.page || 1),
          pageSize: Number(query.pageSize || 50),
        })),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/students/:id', {
    schema: studentIdRouteSchema,
    preHandler: [authenticate, requireCapability('students.read')],
  }, async (request, reply) => {
    try {
      return reply.send(await options.studentsService.getByIdentifier((request.params as { id: string }).id));
    } catch (error) {
      if (error instanceof StudentNotFoundError) return reply.status(error.statusCode).send({ statusCode: error.statusCode, message: error.message });
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/students', {
    schema: studentCreateRouteSchema,
    preHandler: [authenticate, requireCapability('students.manage')],
  }, async (request, reply) => {
    try {
      const body = bodyOf(request);
      const result = await options.studentsService.create(body as unknown as StudentCreateInput, await actorIdFor(request));
      const reason = reasonFrom(request, body, 'Menambahkan siswa dan membuat akun anggota');
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'students', recordId: result.data.student.id,
        newValues: result.data.student as unknown as Record<string, unknown>, changeReason: reason,
      });
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'users', recordId: result.data.account.user_id,
        newValues: { id: result.data.account.user_id, username: result.data.account.username, nama: result.data.student.nama, role: result.data.account.role, is_active: true, is_first_login: result.data.account.is_first_login },
        changeReason: reason,
        metadata: { operation: 'student_account_provisioning', student_id: result.data.student.id },
      });
      return reply.status(201).send({
        success: true,
        data: result.data.student,
        account: { ...result.data.account, temporary_password: result.temporaryPassword },
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/students/:id/provision-account', {
    schema: studentProvisionRouteSchema,
    preHandler: [authenticate, requireCapability('students.manage')],
  }, async (request, reply) => {
    try {
      const body = bodyOf(request);
      const reason = reasonFrom(request, body, 'Membuat akun anggota untuk siswa');
      const result = await options.studentsService.provisionAccount((request.params as { id: string }).id, await actorIdFor(request), reason);
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'students', recordId: result.data.student.id,
        oldValues: { user_id: null }, newValues: { user_id: result.data.account.user_id, is_active: result.data.student.is_active },
        changeReason: reason, metadata: { operation: 'student_account_provisioning' },
      });
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'users', recordId: result.data.account.user_id,
        newValues: { id: result.data.account.user_id, username: result.data.account.username, nama: result.data.student.nama, role: result.data.account.role, is_active: result.data.student.is_active, is_first_login: result.data.account.is_first_login },
        changeReason: reason, metadata: { operation: 'student_account_provisioning', student_id: result.data.student.id },
      });
      return reply.status(201).send({ success: true, data: result.data.student, account: { ...result.data.account, temporary_password: result.temporaryPassword } });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.put('/api/students/:id', {
    schema: studentUpdateRouteSchema,
    preHandler: [authenticate, requireCapability('students.manage')],
  }, async (request, reply) => {
    try {
      const body = bodyOf(request);
      const user = request.user as JwtPayload;
      const result = await options.studentsService.update(
        (request.params as { id: string }).id,
        body as unknown as StudentUpdateInput,
        await actorIdFor(request),
        reasonFrom(request, body, ''),
        user.role === 'teacher',
      );
      if (result.data.is_active !== result.previous.is_active) clearAuthStateCache(result.data.user_id);
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'students', recordId: result.data.id,
        oldValues: result.previous as unknown as Record<string, unknown>, newValues: result.data as unknown as Record<string, unknown>,
        changeReason: reasonFrom(request, body, 'Memperbarui data siswa'),
        metadata: result.data.is_active !== result.previous.is_active ? { operation: result.data.is_active ? 'student_reactivate' : 'student_alumni' } : undefined,
      });
      return reply.send(result.data);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.delete('/api/students/:id', {
    schema: studentIdRouteSchema,
    preHandler: [authenticate, requireCapability('students.manage')],
  }, async (_request, reply) => reply.status(409).send({
    statusCode: 409,
    message: 'Penghapusan permanen data siswa dinonaktifkan untuk menjaga histori. Gunakan aksi Nonaktifkan (Alumni); akun login akan ikut dinonaktifkan.',
  }));
};

export default studentRoutes;
