import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import type { ClassRecord, ClassSelectorOption } from '../types/classes.types';

const classSelectorOptionSchema: z.ZodType<ClassSelectorOption> = z.object({
  id: z.string().min(1),
  nama_kelas: z.string().min(1),
  tingkat: z.string().min(1),
}).loose();

const classRecordSchema: z.ZodType<ClassRecord> = z.object({
  id: z.string().min(1),
  nama_kelas: z.string().min(1),
  tingkat: z.string().min(1),
  is_active: z.boolean(),
  created_at: optionalTextSchema,
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  updated_at: optionalTextSchema,
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).loose();

export const decodeClassOptions = decodeDataEnvelope(z.array(classSelectorOptionSchema));
export const decodeClassList = decodePaginatedResponse(classRecordSchema);
export const decodeClass = decodeDataEnvelope(classRecordSchema);
