import { z } from 'zod';
import { CAPABILITY_VALUES } from '@/shared/auth/capabilities';
import { USER_ROLE_VALUES } from '@/shared/types/common';
import { decodeDataEnvelope } from '@/shared/api/responseValidation';
import { actorSummarySchema, nullableTextSchema } from '@/shared/api/responseSchemas';
import type {
  AccessControlAuditLog,
  AccessControlMatrix,
} from '../types/access-control.types';

const capabilitySchema = z.enum(CAPABILITY_VALUES);

const accessControlMatrixSchema: z.ZodType<AccessControlMatrix> = z.object({
  roles: z.array(z.object({
    role: z.enum(USER_ROLE_VALUES),
    capabilities: z.array(capabilitySchema),
  })),
  permissions: z.array(capabilitySchema),
}).loose();

const accessControlAuditLogSchema: z.ZodType<AccessControlAuditLog> = z.object({
  id: z.string().min(1),
  actor_user_id: nullableTextSchema,
  role_key: z.string().min(1),
  previous_capabilities: z.array(capabilitySchema),
  next_capabilities: z.array(capabilitySchema),
  change_reason: z.string().min(1),
  created_at: z.string().min(1),
  actor: actorSummarySchema.optional(),
}).loose();

const updatedRoleSchema = z.looseObject({
  role: z.enum(USER_ROLE_VALUES),
  capabilities: z.array(capabilitySchema),
}).loose();

export const decodeAccessControlMatrix = decodeDataEnvelope(accessControlMatrixSchema);
export const decodeAccessControlAuditLogs = decodeDataEnvelope(z.array(accessControlAuditLogSchema));
export const decodeUpdatedRoleCapabilities = decodeDataEnvelope(updatedRoleSchema);
