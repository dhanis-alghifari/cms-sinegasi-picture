
import { z } from 'zod';
import {
  EQUIPMENT_AVAILABILITY_VALUES,
  EQUIPMENT_CATEGORY_VALUES,
  EQUIPMENT_CONDITION_VALUES,
} from '../types/equipment.types';

export const equipmentCategoryEnum = z.enum(EQUIPMENT_CATEGORY_VALUES, { error: 'Kategori alat wajib dipilih.' });
export const equipmentConditionEnum = z.enum(EQUIPMENT_CONDITION_VALUES, { error: 'Kondisi fisik alat wajib dipilih.' });
export const equipmentAvailabilityEnum = z.enum(EQUIPMENT_AVAILABILITY_VALUES, { error: 'Status ketersediaan alat wajib dipilih.' });

const equipmentPhotoSchema = z
  .string()
  .trim()
  .refine(
    (val) => val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
    { message: 'URL foto tidak valid' },
  );

export const equipmentSchema = z.object({
  kode_alat: z.string({ error: 'Kode alat wajib diisi.' }).min(2, 'Kode alat minimal 2 karakter').trim().toUpperCase(),
  nama_alat: z.string({ error: 'Nama alat wajib diisi.' }).min(2, 'Nama alat minimal 2 karakter').trim(),
  kategori: equipmentCategoryEnum,
  kondisi: equipmentConditionEnum,
  status: equipmentAvailabilityEnum,
  lokasi_penyimpanan: z.string().optional(),
  serial_number: z.string().optional(),
  foto_urls: z.array(equipmentPhotoSchema, { error: 'Foto alat wajib diunggah.' }).min(3, 'Unggah minimal 3 foto alat dari sudut berbeda'),
  deskripsi: z.string().optional(),
  change_reason: z.string().optional(),
});

export type EquipmentFormValues = z.infer<typeof equipmentSchema>;

export const updateConditionSchema = z.object({
  kondisi: equipmentConditionEnum,
  status: equipmentAvailabilityEnum,
  catatan_kerusakan: z.string().optional(),
  change_reason: z.string({ error: 'Alasan perubahan kondisi alat wajib diisi.' }).min(5, 'Alasan perubahan kondisi alat minimal 5 karakter'),
});

export type UpdateConditionFormValues = z.infer<typeof updateConditionSchema>;
