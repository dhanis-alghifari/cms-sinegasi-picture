
import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string({ error: 'Nama pengguna wajib diisi.' })
    .min(1, 'Nama pengguna wajib diisi.')
    .trim(),
  password: z
    .string({ error: 'Kata sandi wajib diisi.' })
    .min(1, 'Kata sandi wajib diisi.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z
      .string({ error: 'Kata sandi saat ini wajib diisi.' })
      .min(1, 'Kata sandi saat ini wajib diisi.'),
    new_password: z
      .string({ error: 'Kata sandi baru wajib diisi.' })
      .min(8, 'Kata sandi baru minimal 8 karakter.'),
    confirm_password: z
      .string({ error: 'Konfirmasi kata sandi wajib diisi.' })
      .min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirm_password'],
  })
  .refine((data) => /[A-Za-z]/.test(data.new_password) && /\d/.test(data.new_password), {
    message: 'Kata sandi baru harus memiliki huruf dan angka.',
    path: ['new_password'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
