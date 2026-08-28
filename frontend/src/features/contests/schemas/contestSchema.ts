// src/features/contests/schemas/contestSchema.ts
// Zod validation schemas for contest creation and film submissions

import { z } from 'zod';
import { getFutureDateInputValue } from '@/shared/utils/formatDate';

export const contestLevelEnum = z.enum(['bekasi', 'jabodetabek', 'jawa_barat', 'nasional', 'umum']);
export const contestStatusEnum = z.enum(['buka', 'proses_penjurian', 'selesai']);
export const awardStatusEnum = z.enum(['Juara 1', 'Juara 2', 'Juara 3', 'Harapan', 'Finalis', 'Peserta']);

const calendarDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Tanggal tidak valid');

const contestFields = {
  nama_lomba: z.string().min(3, 'Nama lomba minimal 3 karakter').trim(),
  kota: z.string().min(2, 'Kota minimal 2 karakter').max(120).trim(),
  tingkat: contestLevelEnum,
  status: contestStatusEnum,
  tahun_event: z.number().int().min(1900, 'Tahun event tidak valid').max(2200, 'Tahun event tidak valid'),
  website_url: z.string().url('URL website tidak valid').optional().or(z.literal('')),
  deskripsi: z.string().optional(),
  change_reason: z.string().optional(),
};

export const contestSchema = z.object({
  ...contestFields,
  deadline: calendarDate.refine((value) => value >= getFutureDateInputValue(1), 'Deadline harus besok atau setelahnya'),
});

/** Edit permits an unchanged historical deadline; the API enforces future-only dates when it changes. */
export const contestEditSchema = z.object({ ...contestFields, deadline: calendarDate });

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

export const workTypeEnum = z.enum(['short_film', 'documentary', 'photography', 'animation', 'commercial', 'music_video', 'experimental', 'other']);
export const contestEntryStatusEnum = z.enum(['proses_submit', 'sudah_terkirim', 'menunggu_pengumuman', 'selesai']);

export const createContestEntrySchema = z.object({
  title: z.string().min(2, 'Judul karya minimal 2 karakter').max(200).trim(),
  work_type_code: workTypeEnum,
});

export type CreateContestEntryFormValues = z.infer<typeof createContestEntrySchema>;
