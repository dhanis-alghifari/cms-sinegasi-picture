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
  asset_state?: 'active' | 'lost' | 'retired' | string;
  lokasi_penyimpanan?: string;
  serial_number?: string;
  foto_urls?: string[];
  foto_url?: string;
  reservation_status?: 'tersedia' | 'dipesan';
  deskripsi?: string;
  catatan_kerusakan?: string;
  replacement_value?: number;
  replacement_value_currency?: string;
  replacement_value_effective_at?: string;
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

export type EquipmentReportQuery = {
  search?: string;
  kategori?: string;
  kondisi?: string;
  status?: string;
  includeValuation?: boolean;
  includePhotos?: boolean;
  attentionOnly?: boolean;
  scope?: 'all' | 'filtered' | 'attention';
};

export type EquipmentReportCategory = 'camera' | 'lens' | 'audio' | 'lighting' | 'accessory' | 'other';
export type EquipmentReportCondition = 'good' | 'minor_damage' | 'damaged' | 'severely_damaged' | 'under_repair' | 'lost';
export type EquipmentReportAvailability = 'available' | 'borrowed' | 'maintenance';

export type EquipmentReportItem = {
  id: string;
  equipment_code: string;
  name: string;
  category: EquipmentReportCategory;
  condition: EquipmentReportCondition;
  availability_status: EquipmentReportAvailability;
  reservation_status: 'available' | 'reserved';
  storage_location?: string;
  serial_number?: string;
  photo_urls?: string[];
  description?: string;
  damage_notes?: string;
  asset_state: 'active' | 'lost' | 'retired';
  replacement_value?: number;
  replacement_value_currency?: string;
  replacement_value_effective_at?: string;
  updated_at?: string;
};

export type EquipmentReportBreakdown = { key: string; count: number };

export type EquipmentReportSummary = {
  total_units: number;
  available_units: number;
  borrowed_units: number;
  maintenance_units: number;
  reserved_units: number;
  good_condition_units: number;
  damaged_units: number;
  under_repair_units: number;
  lost_units: number;
  attention_units: number;
  valuation_configured_units: number;
  valuation_missing_units: number;
  replacement_value_total?: number;
};

export type EquipmentReport = {
  meta: {
    report_version: 1;
    generated_at: string;
    timezone: 'Asia/Jakarta';
    filters: {
      search?: string;
      category?: string;
      condition?: string;
      status?: string;
      scope: 'all' | 'filtered' | 'attention';
    };
  };
  summary: EquipmentReportSummary;
  breakdowns: {
    by_category: EquipmentReportBreakdown[];
    by_condition: EquipmentReportBreakdown[];
    by_availability: EquipmentReportBreakdown[];
  };
  attention_items: Array<EquipmentReportItem & { attention_reasons: string[] }>;
  items: EquipmentReportItem[];
};

export type EquipmentSummary = {
  totalAlat: number;
  tersedia: number;
  dipinjam: number;
  maintenance: number;
  rusak: number;
  hilang: number;
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

export type EquipmentValuation = {
  id: string;
  equipment_id: string;
  replacement_value: number;
  currency: string;
  effective_at: string;
  source_url?: string;
  notes?: string;
  created_by?: string;
  change_reason: string;
  created_at: string;
};

export type EquipmentValuationInput = {
  equipmentId: string;
  replacementValue: number;
  currency: string;
  effectiveAt?: string;
  sourceUrl?: string;
  notes?: string;
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
  primaryPhoto(id: string): Promise<{ data: string | null; error: EquipmentDatabaseError | null }>;
  report(query: EquipmentReportQuery): Promise<{ data: EquipmentEntry[]; count: number; error: EquipmentDatabaseError | null }>;
  summary(): Promise<{ data: EquipmentSummary | null; error: EquipmentDatabaseError | null }>;
  findById(id: string): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  create(input: EquipmentCreateInput): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  update(input: EquipmentUpdateInput): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  updateCondition(input: EquipmentConditionInput): Promise<{ data: EquipmentEntry | null; error: EquipmentDatabaseError | null }>;
  remove(input: EquipmentDeleteInput): Promise<{ deletedId: string | null; error: EquipmentDatabaseError | null }>;
  listValuations(equipmentId: string): Promise<{ data: EquipmentValuation[]; error: EquipmentDatabaseError | null }>;
  createValuation(input: EquipmentValuationInput): Promise<{ data: EquipmentValuation | null; error: EquipmentDatabaseError | null }>;
}

export type EquipmentSupabaseClient = SupabaseClient | null;
