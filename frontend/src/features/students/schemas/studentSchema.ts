// src/features/students/schemas/studentSchema.ts
// Zod validation schema for student form

import { z } from 'zod';
import { PEMINATAN_VALUES } from '../types/students.types';

export const studentSchema = z.object({
  nis: z.string().min(1, 'NIS wajib diisi').trim(),
  nama: z.string().min(2, 'Nama minimal 2 karakter').trim(),
  kelas: z.string().min(1, 'Kelas wajib diisi').trim(),
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
