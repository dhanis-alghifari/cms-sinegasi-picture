// src/features/grades/schemas/gradeSchema.ts
// Zod validation schemas for assignments and bulk grading

import { z } from 'zod';

export const gradeLetterEnum = z.enum(['A', 'B', 'C', 'D', 'E']);
export const assignmentCategoryEnum = z.enum(['class_task', 'crew_film', 'event_participation', 'other']);

export const createAssignmentSchema = z.object({
  title: z.string().min(3, 'Judul tugas minimal 3 karakter').trim(),
  category: assignmentCategoryEnum,
  description: z.string().optional(),
  kelas: z.string().optional(),
  date: z.string().min(1, 'Tanggal tugas wajib diisi'),
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
  assignment_id: z.string().min(1, 'Tugas/kegiatan wajib dipilih'),
  change_reason: z.string().trim().min(5, 'Alasan penyimpanan minimal 5 karakter'),
});

export type BulkGradingFormValues = z.infer<typeof bulkGradingSchema>;
