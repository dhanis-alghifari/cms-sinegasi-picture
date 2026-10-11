import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import { BORROWING_STATUS_VALUES, type BorrowingRecord, type BorrowingSummary, type BorrowedItem, type ReturnAssessmentPreview, type ReturnEvidenceAccessRecord, type ReturnEvidenceUploadReservation, type ReturnReport, type ReturnReportEvidenceAccessRecord } from '../types/borrowing.types';

const optionalNumber = z.number().nullable().optional().transform((value) => value ?? undefined);
const borrowingStatusSchema = z.enum(BORROWING_STATUS_VALUES);
const itemStatusSchema = z.enum(['pending', 'approved', 'borrowed', 'returned', 'rejected']);

const borrowedItemSchema: z.ZodType<BorrowedItem> = z.object({
  borrowing_item_id: optionalTextSchema,
  equipment_id: z.string().min(1),
  kode_alat: z.string().min(1),
  nama_alat: z.string().min(1),
  status: itemStatusSchema.optional(),
  kondisi_awal: z.string().min(1),
  kondisi_kembali: optionalTextSchema,
  denda_kerusakan: optionalNumber,
  replacement_value: optionalNumber,
}).loose();

const borrowingRecordSchema: z.ZodType<BorrowingRecord> = z.object({
  id: z.string().min(1),
  borrower_id: z.string().min(1),
  borrower_nama: z.string().min(1),
  borrower_nis: optionalTextSchema,
  kelas: optionalTextSchema,
  items: z.array(borrowedItemSchema),
  tanggal_pinjam: z.string().min(1),
  rencana_kembali: z.string().min(1),
  tanggal_dikembalikan: optionalTextSchema,
  keperluan: z.string().min(1),
  status: borrowingStatusSchema,
  catatan_persetujuan: optionalTextSchema,
  catatan_pengembalian: optionalTextSchema,
  total_denda: optionalNumber,
  approved_by: optionalTextSchema,
  processed_return_by: optionalTextSchema,
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  created_at: z.string().min(1),
  updated_at: optionalTextSchema,
  return_reported_at: optionalTextSchema,
  return_notes: optionalTextSchema,
  return_verified_at: optionalTextSchema,
  return_verified_by: optionalTextSchema,
  approved_actor: actorSummarySchema.optional(),
  processed_return_actor: actorSummarySchema.optional(),
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
}).loose();

const borrowingSummarySchema: z.ZodType<BorrowingSummary> = z.object({
  totalActive: z.number().int().nonnegative(),
  pendingApproval: z.number().int().nonnegative(),
  overdueCount: z.number().int().nonnegative(),
  returnedToday: z.number().int().nonnegative(),
}).loose();

export const decodeBorrowingList = decodePaginatedResponse(borrowingRecordSchema);
export const decodeBorrowingSummary = decodeWithSchema(borrowingSummarySchema);
export const decodeBorrowingRecord = decodeDataEnvelope(borrowingRecordSchema);

const returnAssessmentPreviewSchema: z.ZodType<ReturnAssessmentPreview> = z.object({
  borrowing_id: z.string().min(1),
  return_date: z.string().min(1),
  damage_charge: z.number().nonnegative(),
  replacement_charge: z.number().nonnegative().default(0),
  late_charge: z.number().nonnegative(),
  total_charge: z.number().nonnegative(),
  items: z.array(z.object({
    equipment_id: z.string().min(1),
    borrowing_item_id: optionalTextSchema,
    condition: z.string().min(1),
    settlement_method: z.enum(['none', 'repair', 'replacement']),
    replacement_value: optionalNumber,
    repair_cost: optionalNumber,
    charge: z.number().nonnegative(),
  }).loose()),
}).loose();

export const decodeReturnAssessmentPreview = decodeDataEnvelope(returnAssessmentPreviewSchema);

const returnEvidenceUploadReservationSchema: z.ZodType<ReturnEvidenceUploadReservation> = z.object({
  evidence_id: z.string().uuid(),
  report_id: optionalTextSchema,
  upload_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
});

export const decodeReturnEvidenceUploadReservation = decodeDataEnvelope(returnEvidenceUploadReservationSchema);

const returnEvidenceAccessRecordSchema: z.ZodType<ReturnEvidenceAccessRecord> = z.object({
  evidence_id: z.string().uuid(),
  borrowing_id: z.string().min(1),
  borrowing_item_id: z.string().min(1),
  equipment_id: z.string().min(1),
  assessment_item_id: optionalTextSchema,
  original_filename: z.string().min(1),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  file_size_bytes: z.number().int().positive(),
  created_at: optionalTextSchema,
  access_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
}).loose();

export const decodeReturnEvidenceAccessList = decodeDataEnvelope(z.array(returnEvidenceAccessRecordSchema));

const returnReportEvidenceSchema: z.ZodType<ReturnReportEvidenceAccessRecord> = z.object({
  evidence_id: z.string().uuid(),
  borrowing_id: z.string().min(1),
  borrowing_item_id: z.string().min(1),
  equipment_id: z.string().min(1),
  assessment_item_id: optionalTextSchema,
  original_filename: z.string().min(1),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  file_size_bytes: z.number().int().positive(),
  created_at: optionalTextSchema,
  access_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
  source: z.enum(['student_report', 'teacher_return']).nullable().optional().transform((v) => v ?? undefined),
}).loose();

const returnReportSchema: z.ZodType<ReturnReport> = z.object({
  id: z.string().uuid(),
  borrowing_id: z.string().min(1),
  reporter_id: z.string().min(1),
  status: z.enum(['draft', 'pending_verification', 'approved', 'rejected', 'superseded']),
  notes: optionalTextSchema,
  reported_at: optionalTextSchema,
  verified_at: optionalTextSchema,
  verified_by: optionalTextSchema,
  verification_method: z.enum(['photo', 'physical_check', 'photo_and_physical']).nullable().optional().transform((v) => v ?? undefined),
  rejection_reason: optionalTextSchema,
  evidence: z.array(returnReportEvidenceSchema).optional(),
}).loose();

export const decodeReturnReport = decodeDataEnvelope(returnReportSchema);
export const decodeReturnReportEvidenceList = decodeDataEnvelope(z.array(returnReportEvidenceSchema));
