import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import {
  authenticate,
  clearAuthStateCache,
  type JwtPayload,
} from '../../middleware/authMiddleware.js';
import { requireAnyCapability, requireCapability } from '../../middleware/capabilities.js';
import {
  studentCreateRouteSchema,
  studentIdRouteSchema,
  studentLinkAccountRouteSchema,
  studentLinkExistingProfileRouteSchema,
  studentProvisionRouteSchema,
  studentsListRouteSchema,
  studentsOptionsRouteSchema,
  studentsUnlinkedAccountsRouteSchema,
  studentUpdateRouteSchema,
} from '../../shared/http/schemas/students.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { mapRequestFields } from '../../shared/http/request-field-mapping.js';
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

function studentStatusMetadata(isActive: boolean): { operation: string } {
  return { operation: isActive ? 'student_reactivate' : 'student_alumni' };
}

const specializations: Readonly<Record<string, string>> = {
  camera: 'kamera', editing: 'editing', screenwriting: 'naskah', all: 'all',
};

function studentInput(input: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRequestFields(input, {
    student_number: 'nis', name: 'nama', class_name: 'kelas', specialization: 'peminatan',
    phone_number: 'no_telepon', photo_url: 'foto_url',
  });
  return {
    ...mapped,
    ...(typeof mapped.peminatan === 'string' ? { peminatan: specializations[mapped.peminatan] ?? mapped.peminatan } : {}),
  };
}

const studentRoutes: FastifyPluginAsync<StudentRoutesOptions> = async (fastify, options) => {
  const actorIdFor = async (request: FastifyRequest): Promise<string | null> => {
    const user = request.user as JwtPayload;
    return options.studentsService.repositoryIsConfigured() ? resolveDatabaseUserId(user) : user.userId;
  };

  fastify.get('/api/students/options', {
    schema: studentsOptionsRouteSchema,
    preHandler: [authenticate, requireAnyCapability('students.read', 'cash.manage')],
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

  fastify.get('/api/students/unlinked-accounts', {
    schema: studentsUnlinkedAccountsRouteSchema,
    preHandler: [authenticate, requireCapability('users.manage')],
  }, async (request, reply) => {
    try {
      const query = request.query as { q?: string; limit?: string };
      return reply.send({
        success: true,
        data: await options.studentsService.listUnlinkedAccounts({ search: query.q, limit: Number(query.limit || 20) }, await actorIdFor(request)),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/students', {
    schema: studentsListRouteSchema,
    preHandler: [authenticate, requireAnyCapability('students.read', 'borrowing.manage')],
  }, async (request, reply) => {
    try {
      const query = studentInput(request.query as Record<string, unknown>) as {
        search?: string; kelas?: string; peminatan?: string; is_active?: string; page?: string; pageSize?: string;
      };
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
      const body = studentInput(bodyOf(request));
      const result = await options.studentsService.create(body as unknown as StudentCreateInput, await actorIdFor(request));
      const reason = reasonFrom(request, body, 'Menambahkan siswa dan membuat akun sesuai peran');
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

  fastify.post('/api/students/account-links', {
    schema: studentLinkAccountRouteSchema,
    preHandler: [authenticate, requireCapability('users.manage')],
  }, async (request, reply) => {
    try {
      const body = studentInput(bodyOf(request));
      const userId = typeof body.user_id === 'string' ? body.user_id : '';
      const changeReason = reasonFrom(request, body, 'Menautkan akun lama ke data siswa');
      const result = await options.studentsService.linkExistingAccount({
        userId,
        nis: body.nis as string,
        nama: body.nama as string,
        kelas: body.kelas as string,
        peminatan: body.peminatan as string | undefined,
        no_telepon: body.no_telepon as string | undefined,
        foto_url: body.foto_url as string | undefined,
        actorId: (await actorIdFor(request)) || '',
        changeReason,
      });
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'users', recordId: result.data.account.user_id,
        oldValues: result.data.previousAccount,
        newValues: {
          id: result.data.account.user_id,
          username: result.data.account.username,
          nama: result.data.student.nama,
          role: result.data.account.role,
          is_active: result.data.student.is_active,
          is_first_login: result.data.account.is_first_login,
        },
        changeReason,
        metadata: { operation: 'student_account_linking', student_id: result.data.student.id },
      });
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'students', recordId: result.data.student.id,
        newValues: result.data.student as unknown as Record<string, unknown>,
        changeReason,
        metadata: { operation: 'student_account_linking', user_id: result.data.account.user_id },
      });
      return reply.status(201).send({
        success: true,
        data: result.data.student,
        account: result.data.account,
        linked_existing_account: true,
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/students/:id/account-links', {
    schema: studentLinkExistingProfileRouteSchema,
    preHandler: [authenticate, requireCapability('users.manage')],
  }, async (request, reply) => {
    try {
      const body = bodyOf(request);
      const params = request.params as { id: string };
      const userId = typeof body.user_id === 'string' ? body.user_id : '';
      const changeReason = reasonFrom(request, body, 'Menautkan akun lama ke profil siswa yang sudah ada');
      const result = await options.studentsService.linkAccountToExistingProfile({
        studentId: params.id,
        userId,
        actorId: (await actorIdFor(request)) || '',
        changeReason,
      });
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'users', recordId: result.data.account.user_id,
        oldValues: result.data.previousAccount,
        newValues: {
          id: result.data.account.user_id,
          username: result.data.account.username,
          nama: result.data.student.nama,
          role: result.data.account.role,
          is_active: result.data.student.is_active,
          is_first_login: result.data.account.is_first_login,
        },
        changeReason,
        metadata: { operation: 'student_account_linking', student_id: result.data.student.id },
      });
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'students', recordId: result.data.student.id,
        oldValues: { user_id: null }, newValues: { user_id: result.data.account.user_id },
        changeReason,
        metadata: { operation: 'student_account_linking', user_id: result.data.account.user_id },
      });
      return reply.status(200).send({
        success: true,
        data: result.data.student,
        account: result.data.account,
        linked_existing_account: true,
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
      const body = studentInput(bodyOf(request));
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
      const body = studentInput(bodyOf(request));
      const user = request.user as JwtPayload;
      const result = await options.studentsService.update(
        (request.params as { id: string }).id,
        body as unknown as StudentUpdateInput,
        await actorIdFor(request),
        reasonFrom(request, body, ''),
        user.role === 'teacher',
      );
      const statusChanged = result.data.is_active !== result.previous.is_active;
      if (statusChanged) clearAuthStateCache(result.data.user_id);
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'students', recordId: result.data.id,
        oldValues: result.previous as unknown as Record<string, unknown>, newValues: result.data as unknown as Record<string, unknown>,
        changeReason: reasonFrom(request, body, 'Memperbarui data siswa'),
        metadata: statusChanged ? studentStatusMetadata(result.data.is_active) : undefined,
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
