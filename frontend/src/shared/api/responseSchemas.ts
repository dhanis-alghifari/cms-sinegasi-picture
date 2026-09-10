import { z } from 'zod';
import type { ActorSummary } from '@/shared/types/common';

export const optionalTextSchema = z.string().nullable().optional().transform((value) => value ?? undefined);
export const nullableTextSchema = z.string().nullable().optional();
export const actorSummarySchema: z.ZodType<ActorSummary> = z.object({
  id: z.string().min(1),
  nama: z.string().optional(),
  username: z.string().optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
}).loose();
