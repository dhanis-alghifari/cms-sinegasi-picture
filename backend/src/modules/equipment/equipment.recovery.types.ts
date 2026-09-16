import type { SupabaseClient } from '@supabase/supabase-js';
import type { EquipmentEntry } from './equipment.types.js';

export type RecoveryType = 'repair' | 'replacement';
export type RecoveryStatus = 'open' | 'in_progress' | 'awaiting_verification' | 'completed' | 'unrepairable' | 'cancelled';
export type RecoveryStatusFilter = RecoveryStatus | 'active' | 'history';

export type EquipmentRecoveryCase = {
  id: string;
  equipment_id: string;
  assessment_item_id?: string;
  recovery_type: RecoveryType;
  status: RecoveryStatus;
  reported_condition: string;
  notes?: string;
  inspection_photos: string[];
  estimated_cost?: number;
  actual_cost?: number;
  inspection_passed: boolean;
  replacement_equipment_id?: string;
  opened_by?: string;
  verified_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
};

export type RecoveryCreateInput = {
  equipmentId: string;
  recoveryType: RecoveryType;
  assessmentItemId?: string;
  reportedCondition: string;
  notes?: string;
  actorId: string;
  changeReason: string;
};

export type RecoveryRepairInput = {
  caseId: string;
  inspectionPhotos: string[];
  actualCost?: number;
  inspectionPassed: boolean;
  notes?: string;
  actorId: string;
  changeReason: string;
};

export type RecoveryReplacementInput = {
  caseId: string;
  equipmentCode: string;
  name: string;
  category: string;
  storageLocation?: string;
  serialNumber?: string;
  photoUrls: string[];
  description?: string;
  replacementValue?: number;
  actorId: string;
  changeReason: string;
};

export type EquipmentChargeSettlement = {
  id: string;
  assessment_item_id: string;
  borrowing_id: string;
  student_id: string;
  amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'waived';
  notes?: string;
  recorded_by?: string;
  created_at: string;
  updated_at: string;
};

export type ChargePaymentInput = {
  settlementId: string;
  paidAmount: number;
  status: EquipmentChargeSettlement['status'];
  notes?: string;
  actorId: string;
  changeReason: string;
};

export type EquipmentEvidenceType = 'payment' | 'repair' | 'replacement';

export type EquipmentEvidenceRecord = {
  id: string;
  settlement_id: string;
  payment_id?: string;
  evidence_type: EquipmentEvidenceType;
  object_key: string;
  storage_provider: 'r2';
  mime_type: string;
  file_size_bytes: number;
  original_filename: string;
  upload_status: 'pending' | 'attached' | 'abandoned';
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type ChargeEvidenceUploadInput = {
  settlementId: string;
  evidenceType: EquipmentEvidenceType;
  objectKey: string;
  mimeType: string;
  fileSizeBytes: number;
  originalFilename: string;
  actorId: string;
};

export type ChargePaymentEventInput = {
  settlementId: string;
  paymentAmount: number;
  evidenceIds: string[];
  notes?: string;
  actorId: string;
  changeReason: string;
};

export type RecoveryDatabaseError = { code?: string; message?: string; details?: string; hint?: string };
export type RecoverySupabaseClient = SupabaseClient | null;

export type EquipmentRecoveryMemoryState = {
  cases: EquipmentRecoveryCase[];
  charges: EquipmentChargeSettlement[];
  evidence: EquipmentEvidenceRecord[];
};

export interface EquipmentRecoveryRepository {
  isConfigured(): boolean;
  listCases(params?: { equipmentId?: string; status?: RecoveryStatusFilter }): Promise<{ data: EquipmentRecoveryCase[]; error: RecoveryDatabaseError | null }>;
  createCase(input: RecoveryCreateInput): Promise<{ data: EquipmentRecoveryCase | null; error: RecoveryDatabaseError | null }>;
  completeRepair(input: RecoveryRepairInput): Promise<{ data: EquipmentEntry | null; error: RecoveryDatabaseError | null }>;
  registerReplacement(input: RecoveryReplacementInput): Promise<{ data: EquipmentEntry | null; error: RecoveryDatabaseError | null }>;
  listCharges(params?: { studentId?: string; status?: EquipmentChargeSettlement['status'] }): Promise<{ data: EquipmentChargeSettlement[]; error: RecoveryDatabaseError | null }>;
  recordChargePayment(input: ChargePaymentInput): Promise<{ data: EquipmentChargeSettlement | null; error: RecoveryDatabaseError | null }>;
  reserveChargeEvidence(input: ChargeEvidenceUploadInput): Promise<{ data: EquipmentEvidenceRecord | null; error: RecoveryDatabaseError | null }>;
  getChargeEvidence(evidenceId: string): Promise<{ data: EquipmentEvidenceRecord | null; error: RecoveryDatabaseError | null }>;
  listChargeEvidence(settlementId: string): Promise<{ data: EquipmentEvidenceRecord[]; error: RecoveryDatabaseError | null }>;
  recordChargePaymentEvent(input: ChargePaymentEventInput): Promise<{ data: EquipmentChargeSettlement | null; error: RecoveryDatabaseError | null }>;
}
