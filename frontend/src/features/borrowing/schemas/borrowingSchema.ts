// src/features/borrowing/schemas/borrowingSchema.ts
// Zod validation schemas for borrowing requests, approval, and return processing

import { z } from 'zod';

export const borrowingStatusEnum = z.enum([
  'menunggu_persetujuan',
  'disetujui',
  'ditolak',
  'dipinjam',
  'dikembalikan',
  'terlambat',
]);

export const createBorrowingSchema = z.object({
  borrower_id: z.string().min(1, 'Peminjam wajib dipilih'),
  equipment_ids: z.array(z.string()).min(1, 'Minimal 1 peralatan wajib dipilih'),
  tanggal_pinjam: z.string().min(1, 'Tanggal peminjaman wajib diisi'),
  rencana_kembali: z.string().min(1, 'Rencana tanggal pengembalian wajib diisi'),
  keperluan: z.string().min(5, 'Keperluan peminjaman minimal 5 karakter'),
}).superRefine((values, context) => {
  if (values.tanggal_pinjam && values.rencana_kembali && values.rencana_kembali < values.tanggal_pinjam) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rencana_kembali'],
      message: 'Tanggal pengembalian tidak boleh sebelum tanggal peminjaman',
    });
  }
});

export type CreateBorrowingFormValues = z.infer<typeof createBorrowingSchema>;

export const approveRejectSchema = z.object({
  action: z.enum(['approve', 'reject']),
  catatan: z.string().optional(),
  change_reason: z.string().min(5, 'Alasan persetujuan/penolakan wajib diisi (minimal 5 karakter)'),
});

export type ApproveRejectFormValues = z.infer<typeof approveRejectSchema>;

export const processReturnSchema = z.object({
  tanggal_dikembalikan: z.string().min(1, 'Tanggal pengembalian wajib diisi'),
  catatan_pengembalian: z.string().optional(),
  total_denda: z.number().min(0),
  change_reason: z.string().min(5, 'Alasan pemrosesan pengembalian alat wajib diisi (minimal 5 karakter)'),
});

export type ProcessReturnFormValues = z.infer<typeof processReturnSchema>;
