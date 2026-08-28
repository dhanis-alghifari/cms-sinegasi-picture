import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { hasCapability, requireAnyCapability, requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseStudentId, resolveDatabaseUserId } from '../auth/auth.identity.js';
import {
  attendanceBatchWriteRouteSchema,
  attendanceCorrectionRouteSchema,
  attendanceListRouteSchema,
  attendanceRosterRouteSchema,
  attendanceSummaryRouteSchema,
  attendanceWriteRouteSchema,
} from '../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { AttendanceService, AttendanceServiceError } from './attendance.service.js';

type AuditInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
};

export interface AttendanceRoutesOptions {
  attendanceService: AttendanceService;
  persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>;
}

const attendanceRoutes: FastifyPluginAsync<AttendanceRoutesOptions> = async (fastify, options) => {
  const recordBatch = async (request: FastifyRequest, body: Record<string, unknown>) => {
    const databaseUserId = await resolveDatabaseUserId(request.user as JwtPayload);
    if (!databaseUserId && options.attendanceService.repositoryIsConfigured()) {
      throw new AttendanceServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    }
    const records = Array.isArray(body.records) ? body.records : [];
    const data = await options.attendanceService.batchRecord({
      tanggal: typeof body.tanggal === 'string' ? body.tanggal : '',
      kelas: typeof body.kelas === 'string' ? body.kelas : '',
      records: records.map((record) => {
        const item = (record || {}) as Record<string, unknown>;
        return {
          student_id: typeof item.student_id === 'string' ? item.student_id : '',
          status: typeof item.status === 'string' ? item.status : '',
          keterangan: typeof item.keterangan === 'string' ? item.keterangan : undefined,
        };
      }),
      actorId: databaseUserId || (request.user as JwtPayload).userId,
    });
    await options.persistAuditLog(request, {
      action: 'INSERT',
      tableName: 'attendance',
      recordId: null,
      newValues: { tanggal: data.tanggal, kelas: data.kelas, total: data.total },
      changeReason: (request.headers['x-change-reason'] as string) || 'Mencatat absensi massal',
    });
    return data;
  };

  fastify.get('/api/attendance', {
    schema: attendanceListRouteSchema,
    preHandler: [authenticate, requireAnyCapability('attendance.read', 'attendance.read.own')],
  }, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '50', 10) || 50));
    const studentId = hasCapability((request.user as JwtPayload).role, 'attendance.read') ? undefined : await resolveDatabaseStudentId(request.user as JwtPayload);
    if (!studentId && !hasCapability((request.user as JwtPayload).role, 'attendance.read')) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun member belum terhubung ke data siswa.' });
    try {
      return reply.send({ success: true, ...(await options.attendanceService.list({ ...query, student_id: studentId || undefined, page, pageSize })) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/attendance/summary', {
    schema: attendanceSummaryRouteSchema,
    preHandler: [authenticate, requireAnyCapability('attendance.read', 'attendance.read.own')],
  }, async (request, reply) => {
    const { tanggal, scope } = request.query as { tanggal?: string; scope?: string };
    const user = request.user as JwtPayload;
    const own = scope === 'own' || !hasCapability(user.role, 'attendance.read');
    const studentId = own ? await resolveDatabaseStudentId(user) : undefined;
    if (own && !studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun member belum terhubung ke data siswa.' });
    try {
      const targetDate = own ? tanggal : (tanggal || new Date().toISOString().slice(0, 10));
      const summary = await options.attendanceService.summary(targetDate, studentId || undefined);
      const persentaseKehadiran = summary.total > 0
        ? Math.round((summary.hadir / summary.total) * 100 * 10) / 10
        : 0;
      return reply.send({ success: true, tanggal: targetDate, ...summary, persentaseKehadiran });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/attendance/roster', {
    schema: attendanceRosterRouteSchema,
    preHandler: [authenticate, requireCapability('attendance.record')],
  }, async (request, reply) => {
    const query = request.query as { tanggal: string; kelas: string; page?: string; pageSize?: string };
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.pageSize || '10', 10) || 10));
    try {
      return reply.send({
        success: true,
        ...(await options.attendanceService.roster({
          tanggal: query.tanggal,
          kelas: query.kelas,
          page,
          pageSize,
        })),
      });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/attendance/batch', {
    schema: attendanceBatchWriteRouteSchema,
    preHandler: [authenticate, requireCapability('attendance.record')],
  }, async (request, reply) => {
    try {
      const data = await recordBatch(request, (request.body || {}) as Record<string, unknown>);
      return reply.status(201).send({ success: true, ...data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/attendance', {
    schema: attendanceWriteRouteSchema,
    preHandler: [authenticate, requireCapability('attendance.record')],
  }, async (request, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
    if (Array.isArray(body.records)) {
      try {
        const data = await recordBatch(request, body);
        return reply.status(201).send({ success: true, ...data });
      } catch (error) {
        return sendServiceError(error, reply);
      }
    }
    const databaseUserId = await resolveDatabaseUserId(request.user as JwtPayload);
    if (!databaseUserId && options.attendanceService.repositoryIsConfigured()) {
      return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    }
    try {
      const data = await options.attendanceService.record({
        studentId: typeof body.student_id === 'string' ? body.student_id : '',
        tanggal: typeof body.tanggal === 'string' ? body.tanggal : '',
        status: typeof body.status === 'string' ? body.status : '',
        keterangan: typeof body.keterangan === 'string' ? body.keterangan : undefined,
        idempotencyKey: typeof (body.idempotency_key || body.idempotencyKey) === 'string'
          ? String(body.idempotency_key || body.idempotencyKey)
          : undefined,
        actorId: databaseUserId || (request.user as JwtPayload).userId,
      });
      await options.persistAuditLog(request, {
        action: 'INSERT', tableName: 'attendance', recordId: String(data.id || ''), newValues: data,
        changeReason: (request.headers['x-change-reason'] as string) || 'Mencatat kehadiran siswa',
      });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.patch('/api/attendance/:attendance_id/correct', {
    schema: attendanceCorrectionRouteSchema,
    preHandler: [authenticate, requireCapability('attendance.correct')],
  }, async (request, reply) => {
    const { attendance_id: attendanceId } = request.params as { attendance_id: string };
    const body = (request.body || {}) as Record<string, unknown>;
    const databaseUserId = await resolveDatabaseUserId(request.user as JwtPayload);
    if (!databaseUserId && options.attendanceService.repositoryIsConfigured()) {
      return reply.status(503).send({ statusCode: 503, message: 'Akun login belum terhubung ke users.id database yang valid.' });
    }
    try {
      const data = await options.attendanceService.correct({
        attendanceId,
        status: typeof body.status === 'string' ? body.status : '',
        keterangan: typeof body.keterangan === 'string' ? body.keterangan : undefined,
        actorId: databaseUserId || (request.user as JwtPayload).userId,
      });
      await options.persistAuditLog(request, {
        action: 'UPDATE', tableName: 'attendance', recordId: attendanceId, newValues: data,
        changeReason: (request.headers['x-change-reason'] as string) || 'Koreksi status kehadiran siswa',
      });
      return reply.send({ success: true, data });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
};

export default attendanceRoutes;
