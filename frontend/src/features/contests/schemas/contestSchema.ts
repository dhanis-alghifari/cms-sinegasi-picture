// src/features/contests/schemas/contestSchema.ts
// Zod validation schemas for contest creation and film submissions

import { z } from 'zod';

export const contestLevelEnum = z.enum(['Lokal', 'Regional', 'Nasional', 'Internasional']);
export const contestStatusEnum = z.enum(['buka', 'proses_penjurian', 'selesai']);
export const awardStatusEnum = z.enum(['Juara 1', 'Juara 2', 'Juara 3', 'Harapan', 'Finalis', 'Peserta']);

export const contestSchema = z.object({
  nama_lomba: z.string().min(3, 'Nama lomba minimal 3 karakter').trim(),
  penyelenggara: z.string().min(2, 'Penyelenggara minimal 2 karakter').trim(),
  tingkat: contestLevelEnum,
  deadline: z.string().min(1, 'Deadline pendaftaran wajib diisi'),
  status: contestStatusEnum,
  website_url: z.string().url('URL website tidak valid').optional().or(z.literal('')),
  deskripsi: z.string().optional(),
  change_reason: z.string().optional(),
});

export type ContestFormValues = z.infer<typeof contestSchema>;

export const submitFilmEntrySchema = z.object({
  contest_id: z.string().min(1, 'Lomba wajib dipilih'),
  judul_film: z.string().min(2, 'Judul film karya minimal 2 karakter').trim(),
  sutradara_id: z.string().min(1, 'Sutradara / Pembuat karya wajib dipilih'),
  link_video: z.string().url('URL video / trailer tidak valid'),
  award_status: awardStatusEnum,
  sertifikat_url: z.string().url('URL sertifikat tidak valid').optional().or(z.literal('')),
});

export type SubmitFilmEntryFormValues = z.infer<typeof submitFilmEntrySchema>;
