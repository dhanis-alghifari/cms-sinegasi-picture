
import { z } from 'zod';
import { USER_ROLE_VALUES } from '@/shared/types/common';

export const userRoleEnum = z.enum(USER_ROLE_VALUES, { error: 'Peran pengguna wajib dipilih.' });

export const userSchema = z.object({
  username: z
    .string({ error: 'Nama pengguna wajib diisi.' })
    .min(3, 'Nama pengguna minimal 3 karakter.')
    .max(30, 'Nama pengguna maksimal 30 karakter.')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Nama pengguna hanya boleh berisi huruf, angka, titik, strip, dan garis bawah.')
    .trim(),
  nama: z.string({ error: 'Nama pengguna wajib diisi.' }).min(2, 'Nama pengguna minimal 2 karakter').trim(),
  role: userRoleEnum,
  password: z.string().min(8, 'Kata sandi bawaan minimal 8 karakter.').optional().or(z.literal('')),
  change_reason: z.string().optional(),
});

export type UserFormValues = z.infer<typeof userSchema>;

export const resetPasswordSchema = z.object({
  change_reason: z.string({ error: 'Alasan reset kata sandi wajib diisi.' }).min(5, 'Alasan reset kata sandi minimal 5 karakter'),
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
