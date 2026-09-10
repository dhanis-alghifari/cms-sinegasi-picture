import { z } from 'zod';
import { decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import { PEMINATAN_VALUES, type Student, type StudentAccountResponse, type StudentOption } from '../types/students.types';

const studentSchema: z.ZodType<Student> = z.object({
  id: z.string().min(1),
  user_id: optionalTextSchema,
  nis: z.string().min(1),
  nama: z.string().min(1),
  kelas: z.string().min(1),
  peminatan: z.enum(PEMINATAN_VALUES).nullable().optional().transform((value) => value ?? undefined),
  no_telepon: optionalTextSchema,
  foto_url: optionalTextSchema,
  is_active: z.boolean(),
  created_at: z.string().min(1),
  updated_at: optionalTextSchema,
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).loose();

const studentOptionSchema: z.ZodType<StudentOption> = z.object({
  id: z.string().min(1),
  nis: z.string().min(1),
  nama: z.string().min(1),
  kelas: z.string().min(1),
  label: z.string().min(1),
  secondaryLabel: z.string().min(1),
}).loose();

const studentAccountSchema: z.ZodType<StudentAccountResponse> = z.object({
  success: z.literal(true),
  data: studentSchema,
  account: z.object({
    user_id: optionalTextSchema,
    username: z.string().min(1),
    role: z.string().min(1),
    is_first_login: z.boolean(),
    temporary_password: z.string().min(1),
  }).loose(),
}).loose();

const studentOptionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(studentOptionSchema),
  total: z.number().int().nonnegative(),
}).loose().transform(({ data, total }) => ({ data, total }));

export const decodeStudentList = decodePaginatedResponse(studentSchema);
export const decodeStudent = decodeWithSchema(studentSchema);
export const decodeStudentOptions = decodeWithSchema(studentOptionsResponseSchema);
export const decodeStudentAccountResponse = decodeWithSchema(studentAccountSchema);
