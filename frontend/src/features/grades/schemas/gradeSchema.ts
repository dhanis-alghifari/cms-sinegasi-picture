
import { z } from 'zod';
import { ASSIGNMENT_CATEGORY_VALUES, GRADE_LETTER_VALUES } from '../types/grades.types';

export const gradeLetterEnum = z.enum(GRADE_LETTER_VALUES, { error: 'Nilai huruf wajib dipilih.' });
export const assignmentCategoryEnum = z.enum(ASSIGNMENT_CATEGORY_VALUES, { error: 'Kategori tugas wajib dipilih.' });

export const createAssignmentSchema = z.object({
  title: z.string({ error: 'Judul tugas wajib diisi.' }).min(3, 'Judul tugas minimal 3 karakter').trim(),
  category: assignmentCategoryEnum,
  description: z.string().optional(),
  kelas: z.string().optional(),
  date: z.string({ error: 'Tanggal tugas wajib diisi.' }).min(1, 'Tanggal tugas wajib diisi'),
}).superRefine((values, ctx) => {
  if (values.category === 'other' && (!values.description || values.description.trim().length < 3)) {
    ctx.addIssue({
      code: 'custom',
      path: ['description'],
      message: 'Keterangan kategori Lainnya minimal 3 karakter',
    });
  }
});

export type CreateAssignmentFormValues = z.infer<typeof createAssignmentSchema>;

export const bulkGradingSchema = z.object({
  assignment_id: z.string({ error: 'Tugas atau kegiatan wajib dipilih.' }).min(1, 'Tugas atau kegiatan wajib dipilih'),
  change_reason: z.string({ error: 'Alasan penyimpanan wajib diisi.' }).trim().min(5, 'Alasan penyimpanan minimal 5 karakter'),
});

export type BulkGradingFormValues = z.infer<typeof bulkGradingSchema>;
