// src/features/users/schemas/userSchema.ts
// Zod validation schemas for user management forms

import { z } from 'zod';

export const userRoleEnum = z.enum([
  'teacher',
  'leader',
  'vice_leader',
  'treasurer',
  'secretary',
  'equipment_team',
  'contest_team',
  'member',
]);

export const userSchema = z.object({
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .max(30, 'Username maksimal 30 karakter')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, strip, dan underscore')
    .trim(),
  nama: z.string().min(2, 'Nama minimal 2 karakter').trim(),
  role: userRoleEnum,
  password: z.string().min(8, 'Password bawaan minimal 8 karakter').optional().or(z.literal('')),
  change_reason: z.string().optional(),
});

export type UserFormValues = z.infer<typeof userSchema>;

export const resetPasswordSchema = z.object({
  change_reason: z.string().min(5, 'Alasan reset password wajib diisi (minimal 5 karakter)'),
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
