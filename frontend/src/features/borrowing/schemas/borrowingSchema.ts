
import { z } from 'zod';

export const borrowingStatusEnum = z.enum([
  'menunggu_persetujuan',
  'disetujui',
  'ditolak',
  'dipinjam',
  'dikembalikan',
  'terlambat',
], { error: 'Status peminjaman wajib dipilih.' });

export const createBorrowingSchema = z.object({
  borrower_id: z.string({ error: 'Peminjam wajib dipilih.' }).min(1, 'Peminjam wajib dipilih'),
  equipment_ids: z.array(z.string(), { error: 'Pilih minimal satu peralatan.' }).min(1, 'Pilih minimal satu peralatan'),
  tanggal_pinjam: z.string({ error: 'Tanggal peminjaman wajib diisi.' }).min(1, 'Tanggal peminjaman wajib diisi'),
  rencana_kembali: z.string({ error: 'Rencana tanggal pengembalian wajib diisi.' }).min(1, 'Rencana tanggal pengembalian wajib diisi'),
  keperluan: z.string({ error: 'Keperluan peminjaman wajib diisi.' }).min(5, 'Keperluan peminjaman minimal 5 karakter'),
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
  action: z.enum(['approve', 'reject'], { error: 'Pilih tindakan persetujuan atau penolakan.' }),
  catatan: z.string().optional(),
  change_reason: z.string({ error: 'Alasan persetujuan atau penolakan wajib diisi.' }).min(5, 'Alasan persetujuan atau penolakan minimal 5 karakter'),
});

export type ApproveRejectFormValues = z.infer<typeof approveRejectSchema>;

export const processReturnSchema = z.object({
  tanggal_dikembalikan: z.string({ error: 'Tanggal pengembalian wajib diisi.' }).min(1, 'Tanggal pengembalian wajib diisi'),
  catatan_pengembalian: z.string().optional(),
  change_reason: z.string({ error: 'Alasan pemrosesan pengembalian alat wajib diisi.' }).min(5, 'Alasan pemrosesan pengembalian alat minimal 5 karakter'),
});

export type ProcessReturnFormValues = z.infer<typeof processReturnSchema>;
