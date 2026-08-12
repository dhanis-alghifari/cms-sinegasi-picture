import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseUserId } from '../auth/auth.identity.js';
import { attendanceCorrectionRouteSchema, attendanceListRouteSchema, attendanceSummaryRouteSchema, attendanceWriteRouteSchema } from '../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { AttendanceService } from './attendance.service.js';

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
  fastify.get('/api/attendance', {
    schema: attendanceListRouteSchema,
    preHandler: [authenticate, requireCapability('attendance.read')],
  }, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '50', 10) || 50));
    try {
      return reply.send({ success: true, ...(await options.attendanceService.list({ ...query, page, pageSize })) });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.get('/api/attendance/summary', {
    schema: attendanceSummaryRouteSchema,
    preHandler: [authenticate, requireCapability('attendance.read')],
  }, async (request, reply) => {
    const { tanggal } = request.query as { tanggal?: string };
    try {
      const targetDate = tanggal || new Date().toISOString().slice(0, 10);
      const summary = await options.attendanceService.summary(targetDate);
      const persentaseKehadiran = summary.total > 0
        ? Math.round((summary.hadir / summary.total) * 100 * 10) / 10
        : 0;
      return reply.send({ success: true, tanggal: targetDate, ...summary, persentaseKehadiran });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  fastify.post('/api/attendance', {
    schema: attendanceWriteRouteSchema,
    preHandler: [authenticate, requireCapability('attendance.record')],
  }, async (request, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
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
