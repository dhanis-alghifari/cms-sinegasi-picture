import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse, decodeVoidResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import {
  ASSIGNMENT_CATEGORY_VALUES,
  GRADE_LETTER_VALUES,
  type Assignment,
  type AssignmentCategory,
  type GradeSummary,
  type StudentGrade,
} from '../types/grades.types';
import type { PaginatedResponse } from '@/shared/types/common';

const gradeLetterSchema = z.enum(GRADE_LETTER_VALUES);
const assignmentCategorySchema = z.enum(ASSIGNMENT_CATEGORY_VALUES);

const studentGradeSchema: z.ZodType<StudentGrade> = z.object({
  id: z.string().min(1),
  assignment_id: z.string().min(1),
  assignment_title: optionalTextSchema,
  assignment_category: assignmentCategorySchema.optional(),
  student_id: z.string().min(1),
  student_nis: optionalTextSchema,
  student_nama: optionalTextSchema,
  kelas: optionalTextSchema,
  nilai: gradeLetterSchema,
  keterangan: optionalTextSchema,
  graded_by: z.string().min(1),
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  created_at: z.string().min(1),
  updated_at: optionalTextSchema,
  graded_actor: actorSummarySchema.optional(),
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).loose();

export interface AssignmentApiRecord {
  id: string;
  title: string;
  category: AssignmentCategory;
  description?: string;
  deskripsi?: string;
  keterangan_kategori?: string;
  kelas?: string;
  date?: string;
  due_date?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
  created_actor?: Assignment['created_actor'];
  updated_actor?: Assignment['updated_actor'];
}

const assignmentApiRecordSchema: z.ZodType<AssignmentApiRecord> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: assignmentCategorySchema,
  description: optionalTextSchema,
  deskripsi: optionalTextSchema,
  keterangan_kategori: optionalTextSchema,
  kelas: optionalTextSchema,
  date: optionalTextSchema,
  due_date: optionalTextSchema,
  created_by: optionalTextSchema,
  updated_at: optionalTextSchema,
  created_at: z.string().min(1),
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).loose();

function mapAssignment(record: AssignmentApiRecord): Assignment {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    description: record.description ?? record.deskripsi ?? record.keterangan_kategori,
    kelas: record.kelas,
    date: record.date ?? record.due_date ?? '',
    created_by: record.created_by,
    updated_at: record.updated_at,
    created_actor: record.created_actor,
    updated_actor: record.updated_actor,
    created_at: record.created_at,
  };
}

const assignmentListPayloadSchema = z.union([
  z.array(assignmentApiRecordSchema),
  z.object({
    success: z.literal(true),
    data: z.array(assignmentApiRecordSchema),
    total: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
    totalPages: z.number().int().positive().optional(),
  }).loose(),
  z.object({
    data: z.array(assignmentApiRecordSchema),
    total: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
    totalPages: z.number().int().positive().optional(),
  }).loose(),
]).transform((payload): PaginatedResponse<Assignment> => {
  if (Array.isArray(payload)) {
    return {
      data: payload.map(mapAssignment),
      total: payload.length,
      page: 1,
      pageSize: Math.max(1, payload.length),
      totalPages: 1,
    };
  }

  return {
    data: payload.data.map(mapAssignment),
    total: payload.total ?? payload.data.length,
    page: payload.page ?? 1,
    pageSize: payload.pageSize ?? Math.max(1, payload.data.length),
    totalPages: payload.totalPages ?? 1,
  };
});

const assignmentMutationResponseSchema = z.object({
  success: z.literal(true),
  data: assignmentApiRecordSchema,
}).loose().transform(({ data }) => mapAssignment(data));

const gradeSummarySchema: z.ZodType<GradeSummary> = z.object({
  total: z.number().int().nonnegative(),
  counts: z.object({
    A: z.number().int().nonnegative(),
    B: z.number().int().nonnegative(),
    C: z.number().int().nonnegative(),
    D: z.number().int().nonnegative(),
    E: z.number().int().nonnegative(),
  }),
  latest: studentGradeSchema.optional(),
}).loose();

export const decodeGradeList = decodePaginatedResponse(studentGradeSchema);
export const decodeAssignmentList = decodeWithSchema(assignmentListPayloadSchema);
export const decodeGradeSummary = decodeDataEnvelope(gradeSummarySchema);
export const decodeAssignment = decodeWithSchema(assignmentMutationResponseSchema);
export const decodeBulkGrade = decodeVoidResponse;
