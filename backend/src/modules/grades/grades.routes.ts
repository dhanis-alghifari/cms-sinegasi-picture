import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { hasCapability, requireAnyCapability, requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseStudentId, resolveDatabaseUserId } from '../auth/auth.identity.js';
import { assignmentCreateRouteSchema, assignmentListRouteSchema, bulkGradeRouteSchema, gradeDistributionRouteSchema, gradeListRouteSchema } from '../../shared/http/schemas/grades.schema.js';
import { authenticatedRouteSchema } from '../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { GradesService } from './grades.service.js';
import type { AssignmentListQuery, BulkGradeInput, CreateAssignmentInput, GradeListQuery } from './grades.types.js';

type AuditInput = { action: string; tableName: string; recordId?: string | null; newValues?: Record<string, unknown> | null; changeReason: string };
export interface GradesRoutesOptions { gradesService: GradesService; persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>; }
const gradesRoutes: FastifyPluginAsync<GradesRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/grades', { schema: gradeListRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.read', 'grades.read.own')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const query = { ...(request.query as GradeListQuery) };
      const requestedOwn = query.scope === 'own';
      if (requestedOwn || !hasCapability(user.role, 'grades.read')) {
        const studentId = await resolveDatabaseStudentId(user);
        if (!studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun belum terhubung ke profil siswa.' });
        query.scope = 'own';
        query.student_id = studentId;
        delete query.kelas;
      }
      return reply.send({ success: true, ...(await options.gradesService.listGrades(query)) });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/assignments', { schema: assignmentListRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.read', 'grades.read.own')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const query = { ...(request.query as AssignmentListQuery) };
      if (query.scope === 'own' || !hasCapability(user.role, 'grades.read')) {
        const studentId = await resolveDatabaseStudentId(user);
        if (!studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun belum terhubung ke profil siswa.' });
        query.scope = 'own';
        query.student_id = studentId;
        delete query.kelas;
      }
      return reply.send({ success: true, ...(await options.gradesService.listAssignments(query)) });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/summary', { schema: gradeListRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.read', 'grades.read.own')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const query = { ...(request.query as GradeListQuery) };
      if (query.scope === 'own' || !hasCapability(user.role, 'grades.read')) {
        const studentId = await resolveDatabaseStudentId(user);
        if (!studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun belum terhubung ke profil siswa.' });
        query.scope = 'own';
        query.student_id = studentId;
      }
      return reply.send({ success: true, data: await options.gradesService.summary(query) });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/assignments', { schema: assignmentCreateRouteSchema, preHandler: [authenticate, requireCapability('grades.manage')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    try {
      const body = request.body as CreateAssignmentInput;
      const data = await options.gradesService.createAssignment(body, actorId);
      await options.persistAuditLog(request, { action: 'INSERT', tableName: 'assignments', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: String(request.headers['x-change-reason'] || body.change_reason || 'Membuat tugas penilaian baru') });
      return reply.status(201).send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/bulk', { schema: bulkGradeRouteSchema, preHandler: [authenticate, requireCapability('grades.manage')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    const changeReason = request.headers['x-change-reason'] as string | undefined;
    try { const result = await options.gradesService.bulkGrade(request.body as BulkGradeInput, actorId, changeReason); return reply.send({ success: true, data: result.data, message: `${result.count} nilai berhasil disimpan.` }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/distribution', { schema: gradeDistributionRouteSchema, preHandler: [authenticate, requireCapability('grades.read')] }, async (request, reply) => {
    try { return reply.send({ success: true, ...(await options.gradesService.distribution(request.query as { category?: string; kelas?: string; periode?: string })) }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/student-summary', { schema: authenticatedRouteSchema, preHandler: [authenticate, requireCapability('grades.read')] }, async (_request, reply) => {
    try { return reply.send({ success: true, data: await options.gradesService.studentSummary() }); } catch (error) { return sendServiceError(error, reply); }
  });
};

export default gradesRoutes;
