import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import {
  ATTENDANCE_STATUS_VALUES,
  type AttendanceBatchRecord,
  type AttendanceRecord,
  type AttendanceRosterRecord,
  type AttendanceSummaryMetrics,
} from '../types/attendance.types';

const attendanceStatusSchema = z.enum(ATTENDANCE_STATUS_VALUES);

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getStudentRelation(value: unknown): Record<string, unknown> {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === 'object' ? relation as Record<string, unknown> : {};
}

/**
 * Normalize the old nested PostgREST join and the new flat API response at
 * the HTTP boundary. Components only receive the canonical flat shape.
 */
function normalizeAttendanceRecordPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;

  const raw = payload as Record<string, unknown>;
  const student = getStudentRelation(raw.students);
  return {
    ...raw,
    student_nis: hasText(raw.student_nis) ? raw.student_nis : student.nis,
    student_nama: hasText(raw.student_nama) ? raw.student_nama : student.nama,
    kelas: hasText(raw.kelas) ? raw.kelas : student.kelas,
  };
}

const attendanceRecordSchema: z.ZodType<AttendanceRecord> = z.preprocess(
  normalizeAttendanceRecordPayload,
  z.object({
  id: z.string().min(1),
  student_id: z.string().min(1),
  student_nis: z.string().min(1),
  student_nama: z.string().min(1),
  kelas: z.string().min(1),
  tanggal: z.string().min(1),
  status: attendanceStatusSchema,
  keterangan: optionalTextSchema,
  is_locked: z.boolean(),
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  created_at: z.string().min(1),
  updated_at: optionalTextSchema,
  recorded_actor: actorSummarySchema.optional(),
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
  }),
);

const attendanceBatchRecordSchema: z.ZodType<AttendanceBatchRecord> = z.object({
  id: z.string().min(1),
  student_id: z.string().min(1),
  tanggal: z.string().min(1),
  status: attendanceStatusSchema,
  keterangan: optionalTextSchema,
  is_locked: z.boolean(),
  idempotency_key: z.string().min(1),
  created_by: optionalTextSchema,
  created_at: z.string().min(1),
  updated_by: optionalTextSchema,
  updated_at: optionalTextSchema,
}).loose();

const attendanceRosterSchema: z.ZodType<AttendanceRosterRecord> = z.object({
  student_id: z.string().min(1),
  nis: z.string().min(1),
  nama: z.string().min(1),
  kelas: z.string().min(1),
  status: attendanceStatusSchema.optional(),
  keterangan: optionalTextSchema,
}).loose();

const attendanceSummaryResponseSchema: z.ZodType<AttendanceSummaryMetrics> = z.object({
  success: z.literal(true),
  hadir: z.number().nonnegative(),
  sakit: z.number().nonnegative(),
  izin: z.number().nonnegative(),
  alpha: z.number().nonnegative(),
  totalSiswa: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  persentaseHadir: z.number().min(0).max(100).optional(),
  persentaseKehadiran: z.number().min(0).max(100).optional(),
}).loose().transform(({ hadir, sakit, izin, alpha, totalSiswa, total, persentaseHadir, persentaseKehadiran }) => ({
  hadir,
  sakit,
  izin,
  alpha,
  totalSiswa: totalSiswa ?? total ?? 0,
  persentaseHadir: persentaseHadir ?? persentaseKehadiran ?? 0,
}));

const batchResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(attendanceBatchRecordSchema),
  total: z.number().int().nonnegative(),
}).loose().transform(({ data, total }) => ({ data, total }));

export const decodeAttendanceList = decodePaginatedResponse(attendanceRecordSchema);
export const decodeAttendanceSummary = decodeWithSchema(attendanceSummaryResponseSchema);
export const decodeAttendanceRoster = decodePaginatedResponse(attendanceRosterSchema);
export const decodeAttendanceBatch = decodeWithSchema(batchResponseSchema);
export const decodeAttendanceRecord = decodeDataEnvelope(attendanceRecordSchema);
