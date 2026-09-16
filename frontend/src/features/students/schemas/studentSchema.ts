
import { z } from 'zod';
import { PEMINATAN_VALUES } from '../types/students.types';

export const studentSchema = z.object({
  nis: z.string({ error: 'NIS wajib diisi.' }).min(1, 'NIS wajib diisi').trim(),
  nama: z.string({ error: 'Nama siswa wajib diisi.' }).min(2, 'Nama siswa minimal 2 karakter').trim(),
  kelas: z.string({ error: 'Kelas wajib dipilih.' }).min(1, 'Kelas wajib dipilih').trim(),
  peminatan: z.enum(PEMINATAN_VALUES).optional(),
  no_telepon: z.string().optional(),
  foto_url: z
    .string()
    .refine(
      (val) => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
      { message: 'URL foto tidak valid' }
    )
    .optional()
    .or(z.literal('')),
  change_reason: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
