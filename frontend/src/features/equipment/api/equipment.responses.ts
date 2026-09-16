import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import {
  EQUIPMENT_AVAILABILITY_VALUES,
  EQUIPMENT_CATEGORY_VALUES,
  EQUIPMENT_CONDITION_VALUES,
  type Equipment,
  type EquipmentSummary,
  type EquipmentReport,
  type EquipmentRecoveryCase,
  type EquipmentChargeSettlement,
  type EquipmentEvidenceUploadReservation,
  type EquipmentEvidenceAccessRecord,
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
  asset_state: z.enum(['active', 'lost', 'retired']).optional(),
  replacement_value: z.number().nonnegative().optional(),
  replacement_value_currency: optionalTextSchema,
  replacement_value_effective_at: optionalTextSchema,
}).loose();

const equipmentValuationSchema = z.object({
  id: z.string().min(1), equipment_id: z.string().min(1), replacement_value: z.coerce.number().positive(),
  currency: z.string().length(3), effective_at: z.string().min(1), source_url: optionalTextSchema,
  notes: optionalTextSchema, created_at: z.string().min(1),
}).loose();

const equipmentSummarySchema: z.ZodType<EquipmentSummary> = z.object({
  totalAlat: z.number().int().nonnegative(),
  tersedia: z.number().int().nonnegative(),
  dipinjam: z.number().int().nonnegative(),
  maintenance: z.number().int().nonnegative(),
  rusak: z.number().int().nonnegative(),
  hilang: z.number().int().nonnegative().default(0),
}).loose();

const equipmentReportItemSchema = z.object({
  id: z.string().min(1),
  equipment_code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['camera', 'lens', 'audio', 'lighting', 'accessory', 'other']),
  condition: z.enum(['good', 'minor_damage', 'damaged', 'severely_damaged', 'under_repair', 'lost']),
  availability_status: z.enum(['available', 'borrowed', 'maintenance']),
  reservation_status: z.enum(['available', 'reserved']),
  storage_location: optionalTextSchema,
  serial_number: optionalTextSchema,
  photo_urls: z.array(z.string()).optional(),
  description: optionalTextSchema,
  damage_notes: optionalTextSchema,
  asset_state: z.enum(['active', 'lost', 'retired']),
  replacement_value: z.number().nonnegative().optional(),
  replacement_value_currency: optionalTextSchema,
  replacement_value_effective_at: optionalTextSchema,
  updated_at: optionalTextSchema,
}).loose();

const equipmentReportBreakdownSchema = z.object({ key: z.string().min(1), count: z.number().int().nonnegative() }).loose();
const equipmentReportSchema: z.ZodType<EquipmentReport> = z.object({
  meta: z.object({
    report_version: z.literal(1),
    generated_at: z.string().min(1),
    timezone: z.literal('Asia/Jakarta'),
    filters: z.object({
      search: optionalTextSchema,
      category: optionalTextSchema,
      condition: optionalTextSchema,
      status: optionalTextSchema,
      scope: z.enum(['all', 'filtered', 'attention']),
    }).loose(),
  }).loose(),
  summary: z.object({
    total_units: z.number().int().nonnegative(),
    available_units: z.number().int().nonnegative(),
    borrowed_units: z.number().int().nonnegative(),
    maintenance_units: z.number().int().nonnegative(),
    reserved_units: z.number().int().nonnegative(),
    good_condition_units: z.number().int().nonnegative(),
    damaged_units: z.number().int().nonnegative(),
    under_repair_units: z.number().int().nonnegative(),
    lost_units: z.number().int().nonnegative(),
    attention_units: z.number().int().nonnegative(),
    valuation_configured_units: z.number().int().nonnegative(),
    valuation_missing_units: z.number().int().nonnegative(),
    replacement_value_total: z.number().nonnegative().optional(),
  }).loose(),
  breakdowns: z.object({
    by_category: z.array(equipmentReportBreakdownSchema),
    by_condition: z.array(equipmentReportBreakdownSchema),
    by_availability: z.array(equipmentReportBreakdownSchema),
  }).loose(),
  attention_items: z.array(equipmentReportItemSchema.extend({ attention_reasons: z.array(z.string()) })),
  items: z.array(equipmentReportItemSchema),
}).loose();

export const decodeEquipmentList = decodePaginatedResponse(equipmentSchema);
export const decodeEquipment = decodeWithSchema(equipmentSchema);
export const decodeEquipmentEnvelope = decodeDataEnvelope(equipmentSchema);
export const decodeEquipmentSummary = decodeWithSchema(equipmentSummarySchema);
export const decodeEquipmentReport = decodeDataEnvelope(equipmentReportSchema);
export const decodeEquipmentValuations = decodeDataEnvelope(z.array(equipmentValuationSchema));
export const decodeEquipmentValuation = decodeDataEnvelope(equipmentValuationSchema);

const equipmentRecoveryCaseSchema: z.ZodType<EquipmentRecoveryCase> = z.object({
  id: z.string().min(1), equipment_id: z.string().min(1), assessment_item_id: optionalTextSchema,
  recovery_type: z.enum(['repair', 'replacement']), status: z.enum(['open', 'in_progress', 'awaiting_verification', 'completed', 'unrepairable', 'cancelled']),
  reported_condition: z.string().min(1), notes: optionalTextSchema, inspection_photos: z.array(z.string()), inspection_passed: z.boolean().default(false), actual_cost: z.number().nonnegative().optional(),
  replacement_equipment_id: optionalTextSchema, opened_by: optionalTextSchema, verified_by: optionalTextSchema, completed_at: optionalTextSchema,
  created_at: z.string().min(1), updated_at: z.string().min(1),
}).loose();

const equipmentChargeSchema: z.ZodType<EquipmentChargeSettlement> = z.object({
  id: z.string().min(1), assessment_item_id: z.string().min(1), borrowing_id: z.string().min(1), student_id: z.string().min(1),
  amount: z.coerce.number().positive(), paid_amount: z.coerce.number().nonnegative(), status: z.enum(['unpaid', 'partial', 'paid', 'waived']), notes: optionalTextSchema,
  created_at: z.string().min(1), updated_at: z.string().min(1),
}).loose();

export const decodeEquipmentRecoveryCases = decodeDataEnvelope(z.array(equipmentRecoveryCaseSchema));
export const decodeEquipmentRecoveryCase = decodeDataEnvelope(equipmentRecoveryCaseSchema);
export const decodeEquipmentCharges = decodeDataEnvelope(z.array(equipmentChargeSchema));
export const decodeEquipmentCharge = decodeDataEnvelope(equipmentChargeSchema);

const equipmentEvidenceUploadReservationSchema: z.ZodType<EquipmentEvidenceUploadReservation> = z.object({
  evidence_id: z.string().min(1), upload_url: z.string().url(), expires_in_seconds: z.number().int().positive(),
});
export const decodeEquipmentEvidenceUploadReservation = decodeDataEnvelope(equipmentEvidenceUploadReservationSchema);
const equipmentEvidenceAccessSchema: z.ZodType<EquipmentEvidenceAccessRecord> = z.object({
  evidence_id: z.string().min(1), evidence_type: z.enum(['payment', 'repair', 'replacement']), original_filename: z.string().min(1),
  mime_type: z.string().min(1), file_size_bytes: z.number().int().nonnegative(), access_url: z.string().url(), expires_in_seconds: z.number().int().positive(), created_at: z.string().min(1),
});
export const decodeEquipmentEvidenceAccessList = decodeDataEnvelope(z.array(equipmentEvidenceAccessSchema));
