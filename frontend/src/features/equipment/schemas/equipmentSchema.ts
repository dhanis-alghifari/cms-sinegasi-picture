// src/features/equipment/schemas/equipmentSchema.ts
// Zod validation schemas for equipment form and condition updates

import { z } from 'zod';

export const equipmentCategoryEnum = z.enum([
  'Kamera',
  'Lensa',
  'Audio',
  'Lighting',
  'Aksesoris',
  'Lainnya',
]);

export const equipmentConditionEnum = z.enum([
  'bagus',
  'sedikit_kerusakan',
  'rusak',
  'rusak_besar',
  'sedang_diperbaiki',
  'hilang',
]);

export const equipmentAvailabilityEnum = z.enum(['tersedia', 'dipinjam', 'maintenance']);

const equipmentPhotoSchema = z
  .string()
  .trim()
  .refine(
    (val) => val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
    { message: 'URL foto tidak valid' },
  );

export const equipmentSchema = z.object({
  kode_alat: z.string().min(2, 'Kode alat minimal 2 karakter').trim().toUpperCase(),
  nama_alat: z.string().min(2, 'Nama alat minimal 2 karakter').trim(),
  kategori: equipmentCategoryEnum,
  kondisi: equipmentConditionEnum,
  status: equipmentAvailabilityEnum,
  lokasi_penyimpanan: z.string().optional(),
  serial_number: z.string().optional(),
  foto_urls: z.array(equipmentPhotoSchema).min(3, 'Minimal 3 foto alat dari sudut berbeda wajib diunggah'),
  deskripsi: z.string().optional(),
  change_reason: z.string().optional(),
});

export type EquipmentFormValues = z.infer<typeof equipmentSchema>;

export const updateConditionSchema = z.object({
  kondisi: equipmentConditionEnum,
  status: equipmentAvailabilityEnum,
  catatan_kerusakan: z.string().optional(),
  change_reason: z.string().min(5, 'Alasan perbaruan kondisi alat wajib diisi (minimal 5 karakter)'),
});

export type UpdateConditionFormValues = z.infer<typeof updateConditionSchema>;
