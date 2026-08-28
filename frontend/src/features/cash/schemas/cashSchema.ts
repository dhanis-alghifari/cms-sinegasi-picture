// src/features/cash/schemas/cashSchema.ts
// Zod validation schemas for cash & dispute forms according to PRD rules

import { z } from 'zod';

// 600 KiB compressed JPEG becomes roughly 820k characters as a data URL.
// Keep the client contract aligned with the Fastify cash-proof limit.
const MAX_CASH_PROOF_URL_LENGTH = 900_000;

const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Tanggal tidak valid');

// Fast Inbound Cash Form Schema (Bendahara)
export const cashInSchema = z.object({
  type: z.enum(['iuran_wajib', 'pemasukan']),
  payment_mode: z.enum(['pay_now', 'unpaid']),
  metode_pembayaran: z.string().trim().optional(),
  student_id: z.string().optional(),
  tanggal: isoDate,
  jumlah: z.number().finite().min(0, 'Nominal tidak boleh negatif').max(9_999_999_999.99, 'Nominal terlalu besar'),
  keterangan: z.string().optional(),
  foto_bukti_url: z.string().refine(
    (val) => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
    'URL foto tidak valid',
  ).max(MAX_CASH_PROOF_URL_LENGTH, 'Foto terlalu besar. Pilih foto yang lebih kecil.').optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.type === 'iuran_wajib' && !data.student_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['student_id'], message: 'Siswa wajib dipilih untuk pembayaran iuran' });
  }
  if (data.type === 'pemasukan' && data.jumlah <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['jumlah'], message: 'Pemasukan lain-lain harus lebih besar dari nol' });
  }
  if (data.type === 'iuran_wajib' && data.payment_mode === 'unpaid' && data.jumlah !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['jumlah'], message: 'Mode belum bayar harus menggunakan nominal Rp 0' });
  }
  if (data.jumlah > 0 && !data.metode_pembayaran) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['metode_pembayaran'], message: 'Metode pembayaran wajib dipilih' });
  }
  if (data.jumlah === 0 && data.metode_pembayaran) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['metode_pembayaran'], message: 'Metode pembayaran dikosongkan jika belum bayar' });
  }
});

export type CashInFormValues = z.infer<typeof cashInSchema>;

// Outbound Cash Form Schema (Two-Stage Requirement)
export const cashOutSchema = z.object({
  jumlah: z.number().min(1, 'Nominal minimal Rp 1'),
  keterangan: z.string().min(5, 'Rincian pengeluaran (keterangan detail) wajib diisi minimal 5 karakter'),
  foto_bukti_url: z.string().refine(
    (val) => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
    'URL foto tidak valid',
  ).max(MAX_CASH_PROOF_URL_LENGTH, 'Foto terlalu besar. Pilih foto yang lebih kecil.').optional().or(z.literal('')),
});

export type CashOutFormValues = z.infer<typeof cashOutSchema>;

// Student Dispute Form Schema (Wajib Foto Bukti)
export const disputeSchema = z.object({
  transaction_id: z.string().optional(),
  debt_record_id: z.string().optional(),
  reason: z.string().min(10, 'Alasan sanggahan minimal 10 karakter'),
  bukti_sanggahan_url: z.string()
    .min(1, 'Wajib melampirkan foto bukti pembayaran')
    .max(MAX_CASH_PROOF_URL_LENGTH, 'Foto terlalu besar. Pilih foto yang lebih kecil.')
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
      'URL foto bukti tidak valid',
    ),
}).superRefine((data, ctx) => {
  if ((!data.transaction_id && !data.debt_record_id) || (data.transaction_id && data.debt_record_id)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Catatan kas yang disanggah tidak valid' });
  }
});

export type DisputeFormValues = z.infer<typeof disputeSchema>;

// Billing Rules Setting Schema
export const billingRulesSchema = z.object({
  nominal_iuran_wajib: z.number().min(500, 'Nominal iuran wajib minimal Rp 500'),
  holiday_start_date: z.string().optional(),
  holiday_end_date: z.string().optional(),
  skip_week: z.boolean(),
  change_reason: z.string().min(5, 'Alasan perubahan iuran minimal 5 karakter'),
});

export type BillingRulesFormValues = z.infer<typeof billingRulesSchema>;
