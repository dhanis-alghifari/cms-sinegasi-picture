import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import type { AuditLog } from '../types/audit.types';

const recordMapSchema = z.record(z.string(), z.unknown());

const auditLogSchema: z.ZodType<AuditLog> = z.object({
  id: z.string().min(1),
  user_id: optionalTextSchema,
  action: z.string().min(1),
  table_name: z.string().min(1),
  record_id: optionalTextSchema,
  reason: optionalTextSchema,
  created_at: z.string().min(1),
  ip_address: optionalTextSchema,
  user_agent: optionalTextSchema,
  source: optionalTextSchema,
  request_id: optionalTextSchema,
  operation_id: optionalTextSchema,
  changed_fields: z.array(z.string()),
  old_values: recordMapSchema.nullable().optional().transform((value) => value ?? undefined),
  new_values: recordMapSchema.nullable().optional().transform((value) => value ?? undefined),
  metadata: recordMapSchema.nullable().optional().transform((value) => value ?? undefined),
  actor: actorSummarySchema.optional(),
}).loose();

export const decodeAuditLogPage = decodePaginatedResponse(auditLogSchema);
export const decodeAuditLog = decodeDataEnvelope(auditLogSchema);
export const decodeAuditLogResponse = decodeWithSchema(z.object({
  success: z.literal(true),
  data: auditLogSchema,
}).loose());
