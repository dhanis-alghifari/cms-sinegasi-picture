import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActorSummary } from '../../shared/actors/actors.types.js';

export const EQUIPMENT_CATEGORIES = ['Kamera', 'Lensa', 'Audio', 'Lighting', 'Aksesoris', 'Lainnya'] as const;
export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number];

export const EQUIPMENT_CONDITIONS = [
  'bagus',
  'sedikit_kerusakan',
  'rusak',
  'rusak_besar',
  'sedang_diperbaiki',
  'hilang',
] as const;
export type EquipmentCondition = typeof EQUIPMENT_CONDITIONS[number];

export const EQUIPMENT_STATUSES = ['tersedia', 'dipinjam', 'maintenance'] as const;
export type EquipmentStatus = typeof EQUIPMENT_STATUSES[number];

export type EquipmentEntry = {
  id: string;
  kode_alat: string;
  nama_alat: string;
  kategori: EquipmentCategory | string;
  kondisi: EquipmentCondition | string;
  status: EquipmentStatus | string;
  lokasi_penyimpanan?: string;
  serial_number?: string;
  foto_urls?: string[];
  foto_url?: string;
  reservation_status?: 'tersedia' | 'dipesan';
  deskripsi?: string;
  catatan_kerusakan?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
};

export type EquipmentDbRow = Record<string, unknown>;

export type EquipmentListQuery = {
  search?: string;
  kategori?: string;
  kondisi?: string;
  status?: string;
  page: number;
  pageSize: number;
};

export type EquipmentSummary = {
  totalAlat: number;
  tersedia: number;
  dipinjam: number;
  maintenance: number;
  rusak: number;
};

export type EquipmentCreateInput = {
  kodeAlat: string;
  namaAlat: string;
  kategori: EquipmentCategory;
  kondisi: EquipmentCondition;
  status: EquipmentStatus;
  lokasiPenyimpanan?: string;
  serialNumber?: string;
  fotoUrls: string[];
  fotoUrl?: string;
  deskripsi?: string;
  actorId: string;
};

export type EquipmentUpdateInput = {
  id: string;
  changes: Partial<{
    kode_alat: string;
    nama_alat: string;
    kategori: EquipmentCategory;
    kondisi: EquipmentCondition;
    status: EquipmentStatus;
    lokasi_penyimpanan: string;
    serial_number: string;
    foto_urls: string[];
    foto_url: string;
    deskripsi: string;
  }>;
  actorId: string;
  changeReason: string;
};

export type EquipmentConditionInput = {
  id: string;
  kondisi: EquipmentCondition;
  status?: EquipmentStatus;
  catatanKerusakan?: string;
  actorId: string;
  changeReason: string;
};

export type EquipmentDeleteInput = {
  id: string;
  actorId: string;
  changeReason: string;
};

export type EquipmentDatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type EquipmentMemoryState = {
  equipment: EquipmentEntry[];
};

export interface EquipmentRepository {
  isConfigured(): boolean;
  list(query: EquipmentListQuery): Promise<{ data: EquipmentEntry[]; count: number; error: EquipmentDatabaseError | null }>;
  summary(): Promise<{ data: EquipmentSummary | null; error: EquipmentDatabaseError | null }>;
  findById(id: string): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  create(input: EquipmentCreateInput): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  update(input: EquipmentUpdateInput): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  updateCondition(input: EquipmentConditionInput): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  remove(input: EquipmentDeleteInput): Promise<{ deletedId: string | null; error: EquipmentDatabaseError | null }>;
}

export type EquipmentSupabaseClient = SupabaseClient | null;
