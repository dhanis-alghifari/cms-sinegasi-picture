import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { authenticate, type JwtPayload } from '../../middleware/authMiddleware.js';
import { hasCapability, requireAnyCapability, requireCapability } from '../../middleware/capabilities.js';
import { resolveDatabaseStudentId, resolveDatabaseUserId } from '../auth/auth.identity.js';
import { assignmentCreateRouteSchema, assignmentListRouteSchema, bulkGradeRouteSchema, gradeDistributionRouteSchema, gradeListRouteSchema, pklCreateRouteSchema, pklListRouteSchema, pklReviewRouteSchema, reportActionRouteSchema, reportListRouteSchema, reportPeriodCreateRouteSchema, reportPeriodListRouteSchema } from '../../shared/http/schemas/grades.schema.js';
import { authenticatedRouteSchema } from '../../shared/http/schemas/core.schema.js';
import { sendServiceError } from '../../shared/http/sendServiceError.js';
import { mapRequestFields, mapRequestRecords } from '../../shared/http/request-field-mapping.js';
import { GradesService } from './grades.service.js';
import type { AssignmentListQuery, BulkGradeInput, CreateAssignmentInput, GradeListQuery, GradeReportQuery } from './grades.types.js';

type AuditInput = { action: string; tableName: string; recordId?: string | null; newValues?: Record<string, unknown> | null; changeReason: string };
export interface GradesRoutesOptions { gradesService: GradesService; persistAuditLog: (request: FastifyRequest, input: AuditInput) => Promise<void>; }

function gradeQuery(input: Record<string, unknown>): Record<string, unknown> {
  return mapRequestFields(input, { class_name: 'kelas', term: 'periode' });
}

function assignmentInput(input: Record<string, unknown>): Record<string, unknown> {
  return mapRequestFields(input, { category_description: 'keterangan_kategori', class_name: 'kelas' });
}

function bulkGradeInput(input: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRequestFields(input, {});
  return { ...mapped, grades: mapRequestRecords(mapped.grades, { grade: 'nilai', notes: 'keterangan' }) };
}

const gradesRoutes: FastifyPluginAsync<GradesRoutesOptions> = async (fastify, options) => {
  fastify.get('/api/grades', { schema: gradeListRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.read', 'grades.read.own')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const query = { ...(gradeQuery(request.query as Record<string, unknown>) as GradeListQuery) };
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
      const query = { ...(gradeQuery(request.query as Record<string, unknown>) as AssignmentListQuery) };
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
      const query = { ...(gradeQuery(request.query as Record<string, unknown>) as GradeListQuery) };
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
      const body = assignmentInput(request.body as Record<string, unknown>) as CreateAssignmentInput;
      const data = await options.gradesService.createAssignment(body, actorId);
      await options.persistAuditLog(request, { action: 'INSERT', tableName: 'assignments', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: String(request.headers['x-change-reason'] || body.change_reason || 'Membuat tugas penilaian baru') });
      return reply.status(201).send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/bulk', { schema: bulkGradeRouteSchema, preHandler: [authenticate, requireCapability('grades.manage')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    const changeReason = request.headers['x-change-reason'] as string | undefined;
    try { const result = await options.gradesService.bulkGrade(bulkGradeInput(request.body as Record<string, unknown>) as BulkGradeInput, actorId, changeReason); return reply.send({ success: true, data: result.data, message: `${result.count} nilai berhasil disimpan.` }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/distribution', { schema: gradeDistributionRouteSchema, preHandler: [authenticate, requireCapability('grades.read')] }, async (request, reply) => {
    try { return reply.send({ success: true, ...(await options.gradesService.distribution(gradeQuery(request.query as Record<string, unknown>) as { category?: string; kelas?: string; periode?: string })) }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/student-summary', { schema: authenticatedRouteSchema, preHandler: [authenticate, requireCapability('grades.read')] }, async (_request, reply) => {
    try { return reply.send({ success: true, data: await options.gradesService.studentSummary() }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/report-periods', { schema: reportPeriodListRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.read', 'grades.read.own')] }, async (_request, reply) => {
    try { return reply.send({ success: true, data: await options.gradesService.listReportPeriods() }); } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/report-periods', { schema: reportPeriodCreateRouteSchema, preHandler: [authenticate, requireCapability('grades.manage')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    try {
      const data = await options.gradesService.createReportPeriod(request.body as Record<string, unknown>, actorId);
      await options.persistAuditLog(request, { action: 'INSERT', tableName: 'grade_report_periods', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: String(request.headers['x-change-reason'] || 'Membuat periode raport') });
      return reply.status(201).send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/reports', { schema: reportListRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.read', 'grades.read.own')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const query = mapRequestFields(request.query as Record<string, unknown>, { class_name: 'kelas' }) as Record<string, unknown>;
      if (query.scope === 'own' || !hasCapability(user.role, 'grades.read')) {
        const studentId = await resolveDatabaseStudentId(user);
        if (!studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun belum terhubung ke profil siswa.' });
        query.student_id = studentId;
        query.scope = 'own';
        delete query.kelas;
      }
      return reply.send({ success: true, data: await options.gradesService.listReports(query as GradeReportQuery) });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/reports/generate', { schema: reportActionRouteSchema, preHandler: [authenticate, requireCapability('grades.manage')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    try {
      const periodId = String((request.body as Record<string, unknown>).period_id || '');
      const data = await options.gradesService.generateReports(periodId, actorId);
      await options.persistAuditLog(request, { action: 'UPSERT', tableName: 'grade_reports', recordId: periodId, newValues: { period_id: periodId, report_count: data.length }, changeReason: String(request.headers['x-change-reason'] || 'Membuat rekap raport semester') });
      return reply.send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/reports/approve', { schema: reportActionRouteSchema, preHandler: [authenticate, requireCapability('grades.manage')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    try {
      const periodId = String((request.body as Record<string, unknown>).period_id || '');
      const data = await options.gradesService.approveReports(periodId, actorId);
      await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'grade_report_periods', recordId: periodId, newValues: { period_id: periodId, status: 'approved', report_count: data.length }, changeReason: String(request.headers['x-change-reason'] || 'Mengesahkan raport semester') });
      return reply.send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.get('/api/grades/pkl-periods', { schema: pklListRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.read', 'grades.read.own')] }, async (request, reply) => {
    try {
      const user = request.user as JwtPayload;
      const query = mapRequestFields(request.query as Record<string, unknown>, { class_name: 'kelas' }) as Record<string, unknown>;
      if (!hasCapability(user.role, 'grades.read')) {
        const studentId = await resolveDatabaseStudentId(user);
        if (!studentId) return reply.status(403).send({ success: false, error_code: 'STUDENT_SCOPE_UNAVAILABLE', message: 'Akun belum terhubung ke profil siswa.' });
        query.student_id = studentId;
        delete query.kelas;
      }
      return reply.send({ success: true, data: await options.gradesService.listPklPeriods(query as { student_id?: string; kelas?: string }) });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/pkl-periods', { schema: pklCreateRouteSchema, preHandler: [authenticate, requireAnyCapability('grades.manage', 'attendance.correct')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    try {
      const data = await options.gradesService.createPklPeriod(request.body as Record<string, unknown>, actorId);
      await options.persistAuditLog(request, { action: 'INSERT', tableName: 'student_pkl_periods', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: String(request.headers['x-change-reason'] || 'Mengajukan periode PKL siswa') });
      return reply.status(201).send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
  fastify.post('/api/grades/pkl-periods/review', { schema: pklReviewRouteSchema, preHandler: [authenticate, requireCapability('grades.manage')] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const actorId = options.gradesService.repositoryIsConfigured() ? await resolveDatabaseUserId(user) : user.userId;
    try {
      const data = await options.gradesService.reviewPklPeriod(request.body as Record<string, unknown>, actorId);
      await options.persistAuditLog(request, { action: 'UPDATE', tableName: 'student_pkl_periods', recordId: data.id, newValues: data as unknown as Record<string, unknown>, changeReason: String(request.headers['x-change-reason'] || 'Review periode PKL') });
      return reply.send({ success: true, data });
    } catch (error) { return sendServiceError(error, reply); }
  });
};

export default gradesRoutes;
