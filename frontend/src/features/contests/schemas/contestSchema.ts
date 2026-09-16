
import { z } from 'zod';
import { getFutureDateInputValue } from '@/shared/utils/formatDate';
import {
  AWARD_STATUS_VALUES,
  CONTEST_ENTRY_STATUS_VALUES,
  CONTEST_SCOPE_VALUES,
  CONTEST_STATUS_VALUES,
  WORK_TYPE_VALUES,
} from '../types/contests.types';

export const contestLevelEnum = z.enum(CONTEST_SCOPE_VALUES, { error: 'Tingkat lomba wajib dipilih.' });
export const contestStatusEnum = z.enum(CONTEST_STATUS_VALUES, { error: 'Status lomba wajib dipilih.' });
export const awardStatusEnum = z.enum(AWARD_STATUS_VALUES, { error: 'Status penghargaan wajib dipilih.' });

const calendarDate = z.string({ error: 'Tanggal wajib diisi.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Tanggal tidak valid');

const contestFields = {
  nama_lomba: z.string({ error: 'Nama lomba wajib diisi.' }).min(3, 'Nama lomba minimal 3 karakter').trim(),
  kota: z.string({ error: 'Kota wajib diisi.' }).min(2, 'Kota minimal 2 karakter').max(120).trim(),
  tingkat: contestLevelEnum,
  status: contestStatusEnum,
  tahun_event: z.number({ error: 'Tahun event wajib diisi.' }).int().min(1900, 'Tahun event harus antara 1900 dan 2200').max(2200, 'Tahun event harus antara 1900 dan 2200'),
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
  contest_id: z.string({ error: 'Lomba wajib dipilih.' }).min(1, 'Lomba wajib dipilih'),
  judul_film: z.string({ error: 'Judul film wajib diisi.' }).min(2, 'Judul film minimal 2 karakter').trim(),
  sutradara_id: z.string({ error: 'Sutradara atau pembuat karya wajib dipilih.' }).min(1, 'Sutradara atau pembuat karya wajib dipilih'),
  link_video: z.string({ error: 'Tautan video wajib diisi.' }).url('Tautan video atau trailer tidak valid.'),
  award_status: awardStatusEnum,
  sertifikat_url: z.string().url('URL sertifikat tidak valid').optional().or(z.literal('')),
});

export type SubmitFilmEntryFormValues = z.infer<typeof submitFilmEntrySchema>;

export const workTypeEnum = z.enum(WORK_TYPE_VALUES, { error: 'Jenis karya wajib dipilih.' });
export const contestEntryStatusEnum = z.enum(CONTEST_ENTRY_STATUS_VALUES, { error: 'Status karya wajib dipilih.' });

export const createContestEntrySchema = z.object({
  title: z.string({ error: 'Judul karya wajib diisi.' }).min(2, 'Judul karya minimal 2 karakter').max(200).trim(),
  work_type_code: workTypeEnum,
});

export type CreateContestEntryFormValues = z.infer<typeof createContestEntrySchema>;
