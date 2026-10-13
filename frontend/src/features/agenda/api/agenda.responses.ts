import { z } from 'zod';
import { privateMediaPathSchema } from '@/shared/api/privateMedia';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import type { AgendaActivity, AgendaPhoto, AgendaReportActivity } from '../types/agenda.types';

const agendaPhotoSchema: z.ZodType<AgendaPhoto> = z.object({
  id: z.string().min(1),
  activity_id: z.string().min(1),
  upload_status: z.enum(['pending', 'attached', 'abandoned']),
  mime_type: z.string().min(1),
  file_size_bytes: z.coerce.number().int().positive(),
  original_filename: z.string().min(1),
  created_at: z.string().min(1),
}).loose();

const agendaActivitySchema: z.ZodType<AgendaActivity> = z.object({
  id: z.string().min(1),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity_name: z.string().min(1),
  activity_description: z.string().min(1),
  instructor_name: z.string().nullable(),
  pic_names: z.array(z.string().min(1)),
  version: z.number().int().positive(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  archived_at: z.string().nullable(),
  photo: agendaPhotoSchema.nullable(),
}).loose();

export const decodeAgendaPage = decodePaginatedResponse(agendaActivitySchema);
const agendaReportActivitySchema: z.ZodType<AgendaReportActivity> = z.object({
  id: z.string().min(1),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity_name: z.string().min(1),
  activity_description: z.string().min(1),
  instructor_name: z.string().nullable(),
  pic_names: z.array(z.string().min(1)),
  version: z.number().int().positive(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  archived_at: z.string().nullable(),
  photo: agendaPhotoSchema.nullable(),
  photo_access_url: privateMediaPathSchema.nullable(),
  photo_access_expires_in_seconds: z.literal(0).nullable(),
}).loose();
const agendaReportSchema = z.object({
  success: z.literal(true),
  data: z.array(agendaReportActivitySchema),
  total: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  truncated: z.boolean().optional(),
}).loose().transform(({ data, total, pageSize, truncated }) => ({ data, total, page: 1, pageSize, totalPages: 1, truncated }));
export const decodeAgendaReport = decodeWithSchema(agendaReportSchema);
export const decodeAgendaActivity = decodeDataEnvelope(agendaActivitySchema);
export const decodeAgendaUploadReservation = decodeDataEnvelope(z.object({
  photo: z.object({ id: z.string().min(1) }).loose(),
  upload_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
}).loose());
export const decodeAgendaPhotoCompletion = decodeDataEnvelope(z.object({
  photo: agendaPhotoSchema,
  access_url: privateMediaPathSchema,
  expires_in_seconds: z.literal(0),
}).loose());
export const decodeAgendaPhotoAccess = decodeDataEnvelope(z.object({
  access_url: privateMediaPathSchema,
  expires_in_seconds: z.literal(0),
}).loose());
