import { z } from 'zod';
import { decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import {
  EQUIPMENT_AVAILABILITY_VALUES,
  EQUIPMENT_CATEGORY_VALUES,
  EQUIPMENT_CONDITION_VALUES,
  type Equipment,
  type EquipmentSummary,
} from '../types/equipment.types';

const equipmentSchema: z.ZodType<Equipment> = z.object({
  id: z.string().min(1),
  kode_alat: z.string().min(1),
  nama_alat: z.string().min(1),
  kategori: z.enum(EQUIPMENT_CATEGORY_VALUES),
  kondisi: z.enum(EQUIPMENT_CONDITION_VALUES),
  status: z.enum(EQUIPMENT_AVAILABILITY_VALUES),
  reservation_status: z.enum(['tersedia', 'dipesan']).optional(),
  lokasi_penyimpanan: optionalTextSchema,
  serial_number: optionalTextSchema,
  foto_urls: z.array(z.string()).optional(),
  foto_url: optionalTextSchema,
  deskripsi: optionalTextSchema,
  created_at: z.string().min(1),
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  updated_at: optionalTextSchema,
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).loose();

const equipmentSummarySchema: z.ZodType<EquipmentSummary> = z.object({
  totalAlat: z.number().int().nonnegative(),
  tersedia: z.number().int().nonnegative(),
  dipinjam: z.number().int().nonnegative(),
  maintenance: z.number().int().nonnegative(),
  rusak: z.number().int().nonnegative(),
}).loose();

export const decodeEquipmentList = decodePaginatedResponse(equipmentSchema);
export const decodeEquipment = decodeWithSchema(equipmentSchema);
export const decodeEquipmentSummary = decodeWithSchema(equipmentSummarySchema);
