import { z } from 'zod';
import { decodeDataEnvelope, decodePaginatedResponse, decodeWithSchema } from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import { BORROWING_STATUS_VALUES, type BorrowingRecord, type BorrowingSummary, type BorrowedItem } from '../types/borrowing.types';

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
