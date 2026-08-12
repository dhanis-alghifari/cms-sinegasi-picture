// src/features/auth/schemas/loginSchema.ts
// Zod validation schemas for auth forms

import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username wajib diisi')
    .trim(),
  password: z
    .string()
    .min(1, 'Password wajib diisi'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z
      .string()
      .min(1, 'Password saat ini wajib diisi'),
    new_password: z
      .string()
      .min(8, 'Password baru minimal 8 karakter'),
    confirm_password: z
      .string()
      .min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm_password'],
  })
  .refine((data) => /[A-Za-z]/.test(data.new_password) && /\d/.test(data.new_password), {
    message: 'Password baru harus memiliki huruf dan angka',
    path: ['new_password'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
