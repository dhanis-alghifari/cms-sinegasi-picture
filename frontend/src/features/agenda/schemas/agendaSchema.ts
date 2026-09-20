import { z } from 'zod';

export const agendaSchema = z.object({
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib diisi.'),
  activity_name: z.string().min(2, 'Nama kegiatan minimal 2 karakter.').max(120).trim(),
  activity_description: z.string().min(2, 'Uraian kegiatan minimal 2 karakter.').max(2000).trim(),
  instructor_name: z.string().min(2, 'Nama pengajar minimal 2 karakter.').max(120).trim(),
  pic_names: z.string().min(2, 'PIC wajib diisi.'),
  change_reason: z.string().optional(),
});
