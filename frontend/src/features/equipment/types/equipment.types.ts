import type { ActorSummary } from '@/shared/types/common';

export const EQUIPMENT_CATEGORY_VALUES = ['Kamera', 'Lensa', 'Audio', 'Lighting', 'Aksesoris', 'Lainnya'] as const;
export type EquipmentCategory = typeof EQUIPMENT_CATEGORY_VALUES[number];

export const EQUIPMENT_CONDITION_VALUES = [
  'bagus',
  'sedikit_kerusakan',
  'rusak',
  'rusak_besar',
  'sedang_diperbaiki',
  'hilang',
] as const;
export type EquipmentCondition = typeof EQUIPMENT_CONDITION_VALUES[number];

export const EQUIPMENT_AVAILABILITY_VALUES = ['tersedia', 'dipinjam', 'maintenance'] as const;
export type EquipmentAvailability = typeof EQUIPMENT_AVAILABILITY_VALUES[number];

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
  asset_state?: 'active' | 'lost' | 'retired';
  replacement_value?: number;
  replacement_value_currency?: string;
  replacement_value_effective_at?: string;
}

export interface EquipmentValuation {
  id: string;
  equipment_id: string;
  replacement_value: number;
  currency: string;
  effective_at: string;
  source_url?: string;
  notes?: string;
  created_at: string;
}

export interface CreateEquipmentValuationPayload {
  replacement_value: number;
  currency?: string;
  effective_at?: string;
  source_url?: string;
  notes?: string;
}

export interface EquipmentFilterParams {
  page?: number;
  pageSize?: number;
  purpose?: 'borrowing_request';
  search?: string;
  kategori?: EquipmentCategory;
  kondisi?: EquipmentCondition;
  status?: EquipmentAvailability;
}

export interface EquipmentReportParams {
  search?: string;
  kategori?: EquipmentCategory;
  kondisi?: EquipmentCondition;
  status?: EquipmentAvailability;
  scope?: 'all' | 'filtered' | 'attention';
  includeValuation?: boolean;
  includePhotos?: boolean;
}

export interface EquipmentReportItem {
  id: string;
  equipment_code: string;
  name: string;
  category: 'camera' | 'lens' | 'audio' | 'lighting' | 'accessory' | 'other';
  condition: 'good' | 'minor_damage' | 'damaged' | 'severely_damaged' | 'under_repair' | 'lost';
  availability_status: 'available' | 'borrowed' | 'maintenance';
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
}

export interface EquipmentReport {
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
  summary: {
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
  breakdowns: {
    by_category: Array<{ key: string; count: number }>;
    by_condition: Array<{ key: string; count: number }>;
    by_availability: Array<{ key: string; count: number }>;
  };
  attention_items: Array<EquipmentReportItem & { attention_reasons: string[] }>;
  items: EquipmentReportItem[];
}

export interface EquipmentSummary {
  totalAlat: number;
  tersedia: number;
  dipinjam: number;
  maintenance: number;
  rusak: number;
  hilang: number;
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

export type RecoveryType = 'repair' | 'replacement';
export type RecoveryStatus = 'open' | 'in_progress' | 'awaiting_verification' | 'completed' | 'unrepairable' | 'cancelled';

export interface EquipmentRecoveryCase {
  id: string;
  equipment_id: string;
  assessment_item_id?: string;
  recovery_type: RecoveryType;
  status: RecoveryStatus;
  reported_condition: string;
  notes?: string;
  inspection_photos: string[];
  inspection_passed: boolean;
  actual_cost?: number;
  replacement_equipment_id?: string;
  opened_by?: string;
  verified_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EquipmentChargeSettlement {
  id: string;
  assessment_item_id: string;
  borrowing_id: string;
  student_id: string;
  amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'waived';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type EquipmentEvidenceType = 'payment' | 'repair' | 'replacement';

export interface EquipmentEvidenceUploadReservation {
  evidence_id: string;
  upload_url: string;
  expires_in_seconds: number;
}

export interface EquipmentEvidenceAccessRecord {
  evidence_id: string;
  evidence_type: EquipmentEvidenceType;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  access_url: string;
  expires_in_seconds: number;
  created_at: string;
}
