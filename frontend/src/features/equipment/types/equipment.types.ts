// src/features/equipment/types/equipment.types.ts
// Equipment catalog & condition domain types according to PRD schema
import type { ActorSummary } from '@/shared/types/common';

export type EquipmentCategory = 'Kamera' | 'Lensa' | 'Audio' | 'Lighting' | 'Aksesoris' | 'Lainnya';

export type EquipmentCondition =
  | 'bagus'
  | 'sedikit_kerusakan'
  | 'rusak'
  | 'rusak_besar'
  | 'sedang_diperbaiki'
  | 'hilang';

export type EquipmentAvailability = 'tersedia' | 'dipinjam' | 'maintenance';

export interface Equipment {
  id: string;
  kode_alat: string; // e.g. CAM-001
  nama_alat: string;
  kategori: EquipmentCategory;
  kondisi: EquipmentCondition;
  status: EquipmentAvailability;
  /** A pending/approved/active borrowing reservation without changing physical stock status. */
  reservation_status?: 'tersedia' | 'dipesan';
  lokasi_penyimpanan?: string;
  serial_number?: string;
  foto_urls?: string[];
  /** Backward-compatible first photo field returned by older API consumers. */
  foto_url?: string;
  deskripsi?: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface EquipmentFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  kategori?: EquipmentCategory;
  kondisi?: EquipmentCondition;
  status?: EquipmentAvailability;
}

export interface EquipmentSummary {
  totalAlat: number;
  tersedia: number;
  dipinjam: number;
  maintenance: number;
  rusak: number;
}

export interface CreateEquipmentPayload {
  kode_alat: string;
  nama_alat: string;
  kategori: EquipmentCategory;
  kondisi: EquipmentCondition;
  status: EquipmentAvailability;
  lokasi_penyimpanan?: string;
  serial_number?: string;
  foto_urls: string[];
  foto_url?: string;
  deskripsi?: string;
}

export type UpdateEquipmentPayload = Partial<CreateEquipmentPayload>;

export interface UpdateConditionPayload {
  kondisi: EquipmentCondition;
  status?: EquipmentAvailability;
  catatan_kerusakan?: string;
}
