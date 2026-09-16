import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EQUIPMENT_SELECT, mapEquipmentRow, textValue } from './equipment.helpers.js';
import type { EquipmentEntry, EquipmentMemoryState } from './equipment.types.js';
import type {
  ChargeEvidenceUploadInput,
  ChargePaymentEventInput,
  ChargePaymentInput,
  EquipmentChargeSettlement,
  EquipmentEvidenceRecord,
  EquipmentRecoveryCase,
  EquipmentRecoveryMemoryState,
  EquipmentRecoveryRepository,
  RecoveryCreateInput,
  RecoveryDatabaseError,
  RecoveryRepairInput,
  RecoveryReplacementInput,
  RecoverySupabaseClient,
} from './equipment.recovery.types.js';

const RECOVERY_CASE_SELECT = 'id,equipment_id,assessment_item_id,recovery_type,status,reported_condition,notes,inspection_photos,estimated_cost,actual_cost,inspection_passed,replacement_equipment_id,opened_by,verified_by,completed_at,created_at,updated_at';
const CHARGE_SETTLEMENT_SELECT = 'id,assessment_item_id,borrowing_id,student_id,amount,paid_amount,status,notes,recorded_by,created_at,updated_at';
const CHARGE_EVIDENCE_SELECT = 'id,settlement_id,payment_id,evidence_type,object_key,storage_provider,mime_type,file_size_bytes,original_filename,upload_status,created_by,created_at,updated_at';
const RECOVERY_CASE_LIST_LIMIT = 200;
const CHARGE_LIST_LIMIT = 200;
const CHARGE_EVIDENCE_LIST_LIMIT = 50;

function databaseError(error: unknown): RecoveryDatabaseError | null {
  if (!error) return null;
  const value = error as RecoveryDatabaseError;
  return { code: value.code, message: value.message, details: value.details, hint: value.hint };
}

function rpcId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') return (value as { id: string }).id;
  return null;
}

function mapCase(row: Record<string, unknown>): EquipmentRecoveryCase {
  const photos = Array.isArray(row.inspection_photos)
    ? row.inspection_photos.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    id: textValue(row.id), equipment_id: textValue(row.equipment_id),
    assessment_item_id: textValue(row.assessment_item_id) || undefined,
    recovery_type: textValue(row.recovery_type) as EquipmentRecoveryCase['recovery_type'],
    status: textValue(row.status) as EquipmentRecoveryCase['status'],
    reported_condition: textValue(row.reported_condition), notes: textValue(row.notes) || undefined,
    inspection_photos: photos,
    estimated_cost: row.estimated_cost === null || row.estimated_cost === undefined ? undefined : Number(row.estimated_cost),
    actual_cost: row.actual_cost === null || row.actual_cost === undefined ? undefined : Number(row.actual_cost),
    inspection_passed: row.inspection_passed === true,
    replacement_equipment_id: textValue(row.replacement_equipment_id) || undefined,
    opened_by: textValue(row.opened_by) || undefined, verified_by: textValue(row.verified_by) || undefined,
    completed_at: textValue(row.completed_at) || undefined, created_at: textValue(row.created_at), updated_at: textValue(row.updated_at),
  };
}

function mapCharge(row: Record<string, unknown>): EquipmentChargeSettlement {
  return {
    id: textValue(row.id), assessment_item_id: textValue(row.assessment_item_id), borrowing_id: textValue(row.borrowing_id),
    student_id: textValue(row.student_id), amount: Number(row.amount || 0), paid_amount: Number(row.paid_amount || 0),
    status: textValue(row.status, 'unpaid') as EquipmentChargeSettlement['status'], notes: textValue(row.notes) || undefined,
    recorded_by: textValue(row.recorded_by) || undefined, created_at: textValue(row.created_at), updated_at: textValue(row.updated_at),
  };
}

function mapEvidence(row: Record<string, unknown>): EquipmentEvidenceRecord {
  return {
    id: textValue(row.id),
    settlement_id: textValue(row.settlement_id),
    payment_id: textValue(row.payment_id) || undefined,
    evidence_type: textValue(row.evidence_type) as EquipmentEvidenceRecord['evidence_type'],
    object_key: textValue(row.object_key),
    storage_provider: 'r2',
    mime_type: textValue(row.mime_type),
    file_size_bytes: Number(row.file_size_bytes || 0),
    original_filename: textValue(row.original_filename),
    upload_status: textValue(row.upload_status, 'pending') as EquipmentEvidenceRecord['upload_status'],
    created_by: textValue(row.created_by) || undefined,
    created_at: textValue(row.created_at),
    updated_at: textValue(row.updated_at),
  };
}

function findEquipment(state: EquipmentMemoryState, id: string): EquipmentEntry | undefined {
  return state.equipment.find((item) => item.id === id);
}

function matchesRecoveryStatus(
  status: EquipmentRecoveryCase['status'],
  filter: string | undefined,
  activeStatuses: readonly string[],
  historyStatuses: readonly string[],
): boolean {
  if (!filter) return true;
  if (filter === 'active') return activeStatuses.includes(status);
  if (filter === 'history') return historyStatuses.includes(status);
  return status === filter;
}

export function createEquipmentRecoveryRepository(
  client: RecoverySupabaseClient,
  recoveryState: EquipmentRecoveryMemoryState,
  equipmentState: EquipmentMemoryState,
): EquipmentRecoveryRepository {
  const configuredClient = client as SupabaseClient | null;
  return {
    isConfigured: () => configuredClient !== null,

    async listCases(params) {
      const activeStatuses = ['open', 'in_progress', 'awaiting_verification'] as const;
      const historyStatuses = ['completed', 'unrepairable', 'cancelled'] as const;
      if (!configuredClient) {
        return {
          data: recoveryState.cases.filter((item) => {
            const matchesEquipment = !params?.equipmentId || item.equipment_id === params.equipmentId;
            const matchesStatus = matchesRecoveryStatus(item.status, params?.status, activeStatuses, historyStatuses);
            return matchesEquipment && matchesStatus;
          }).slice(0, RECOVERY_CASE_LIST_LIMIT),
          error: null,
        };
      }
      let query = configuredClient.from('equipment_recovery_cases').select(RECOVERY_CASE_SELECT).order('created_at', { ascending: false }).limit(RECOVERY_CASE_LIST_LIMIT);
      if (params?.equipmentId) query = query.eq('equipment_id', params.equipmentId);
      if (params?.status === 'active') query = query.in('status', [...activeStatuses]);
      else if (params?.status === 'history') query = query.in('status', [...historyStatuses]);
      else if (params?.status) query = query.eq('status', params.status);
      const result = await query;
      const error = databaseError(result.error);
      return { data: error ? [] : ((result.data || []) as Array<Record<string, unknown>>).map(mapCase), error };
    },

    async createCase(input) {
      if (!configuredClient) {
        const equipment = findEquipment(equipmentState, input.equipmentId);
        if (!equipment) return { data: null, error: { code: 'EQUIPMENT_NOT_FOUND', message: 'Alat tidak ditemukan.' } };
        if (equipment.status === 'dipinjam') return { data: null, error: { code: 'EQUIPMENT_STILL_BORROWED', message: 'Alat yang masih dipinjam belum dapat diproses.' } };
        if (recoveryState.cases.some((item) => item.equipment_id === input.equipmentId && ['open', 'in_progress', 'awaiting_verification'].includes(item.status))) return { data: null, error: { code: 'RECOVERY_CASE_ALREADY_OPEN', message: 'Alat sudah memiliki tindak lanjut yang belum selesai.' } };
        const now = new Date().toISOString();
        const item: EquipmentRecoveryCase = { id: `recovery-${crypto.randomUUID()}`, equipment_id: input.equipmentId, assessment_item_id: input.assessmentItemId, recovery_type: input.recoveryType, status: 'open', reported_condition: input.reportedCondition, notes: input.notes, inspection_photos: [], inspection_passed: false, opened_by: input.actorId, created_at: now, updated_at: now };
        recoveryState.cases.unshift(item);
        equipment.status = 'maintenance'; equipment.kondisi = input.reportedCondition; equipment.asset_state = input.reportedCondition === 'hilang' ? 'lost' : 'active'; equipment.updated_at = now; equipment.updated_by = input.actorId;
        return { data: item, error: null };
      }
      const result = await configuredClient.rpc('create_equipment_recovery_case_atomic', {
        p_equipment_id: input.equipmentId, p_recovery_type: input.recoveryType, p_assessment_item_id: input.assessmentItemId || null,
        p_reported_condition: input.reportedCondition, p_notes: input.notes || null, p_opened_by: input.actorId, p_change_reason: input.changeReason,
      });
      const error = databaseError(result.error);
      const id = rpcId(result.data);
      if (error || !id) return { data: null, error: error || { code: 'RECOVERY_CASE_CREATE_FAILED', message: 'Tindak lanjut alat gagal dibuat.' } };
      const created = await configuredClient.from('equipment_recovery_cases').select(RECOVERY_CASE_SELECT).eq('id', id).single();
      const createdError = databaseError(created.error);
      return { data: createdError || !created.data ? null : mapCase(created.data as Record<string, unknown>), error: createdError };
    },

    async completeRepair(input) {
      if (!configuredClient) {
        const item = recoveryState.cases.find((candidate) => candidate.id === input.caseId);
        if (!item) return { data: null, error: { code: 'RECOVERY_CASE_NOT_FOUND', message: 'Tindak lanjut alat tidak ditemukan.' } };
        if (item.recovery_type !== 'repair') return { data: null, error: { code: 'RECOVERY_CASE_TYPE_INVALID', message: 'Tindak lanjut ini bukan perbaikan.' } };
        if (!['open', 'in_progress', 'awaiting_verification'].includes(item.status)) return { data: null, error: { code: 'RECOVERY_CASE_NOT_OPEN', message: 'Tindak lanjut ini sudah selesai atau tidak dapat diubah.' } };
        const equipment = findEquipment(equipmentState, item.equipment_id);
        if (!equipment) return { data: null, error: { code: 'EQUIPMENT_NOT_FOUND', message: 'Alat tidak ditemukan.' } };
        if (!input.inspectionPassed) return { data: null, error: { code: 'RECOVERY_INSPECTION_REQUIRED', message: 'Checklist pemeriksaan akhir wajib dikonfirmasi.' } };
        const now = new Date().toISOString(); item.status = 'completed'; item.inspection_photos = input.inspectionPhotos; item.actual_cost = input.actualCost; item.inspection_passed = true; item.notes = input.notes || item.notes; item.verified_by = input.actorId; item.completed_at = now; item.updated_at = now;
        equipment.kondisi = 'bagus'; equipment.status = 'tersedia'; equipment.asset_state = 'active'; equipment.updated_at = now; equipment.updated_by = input.actorId; equipment.catatan_kerusakan = undefined;
        return { data: { ...equipment }, error: null };
      }
      const result = await configuredClient.rpc('complete_equipment_repair_atomic', {
        p_case_id: input.caseId, p_inspection_photos: input.inspectionPhotos, p_actual_cost: input.actualCost || null,
        p_notes: input.notes || null, p_inspection_passed: input.inspectionPassed, p_verified_by: input.actorId, p_change_reason: input.changeReason,
      });
      const error = databaseError(result.error); const id = rpcId(result.data);
      if (error || !id) return { data: null, error: error || { code: 'RECOVERY_REPAIR_FAILED', message: 'Penyelesaian perbaikan gagal disimpan.' } };
      const equipment = await configuredClient.from('equipment').select(EQUIPMENT_SELECT).eq('id', id).single();
      const equipmentError = databaseError(equipment.error);
      return { data: equipmentError || !equipment.data ? null : mapEquipmentRow(equipment.data as unknown as Record<string, unknown>), error: equipmentError };
    },

    async registerReplacement(input) {
      if (!configuredClient) {
        const item = recoveryState.cases.find((candidate) => candidate.id === input.caseId);
        if (!item || item.recovery_type !== 'replacement') return { data: null, error: { code: 'RECOVERY_CASE_NOT_FOUND', message: 'Tindak lanjut penggantian tidak ditemukan.' } };
        if (!['open', 'in_progress', 'awaiting_verification'].includes(item.status)) return { data: null, error: { code: 'RECOVERY_CASE_NOT_OPEN', message: 'Tindak lanjut ini sudah selesai atau tidak dapat diubah.' } };
        if (equipmentState.equipment.some((candidate) => candidate.kode_alat === input.equipmentCode)) return { data: null, error: { code: 'EQUIPMENT_CODE_ALREADY_EXISTS', message: 'Kode alat sudah digunakan.' } };
        const oldEquipment = findEquipment(equipmentState, item.equipment_id); if (!oldEquipment) return { data: null, error: { code: 'EQUIPMENT_NOT_FOUND', message: 'Alat lama tidak ditemukan.' } };
        const now = new Date().toISOString(); const replacement: EquipmentEntry = { id: `eq-${crypto.randomUUID()}`, kode_alat: input.equipmentCode, nama_alat: input.name, kategori: input.category, kondisi: 'bagus', status: 'tersedia', asset_state: 'active', lokasi_penyimpanan: input.storageLocation, serial_number: input.serialNumber, foto_urls: input.photoUrls, foto_url: input.photoUrls[0], deskripsi: input.description, created_by: input.actorId, created_at: now };
        equipmentState.equipment.unshift(replacement); oldEquipment.asset_state = item.reported_condition === 'hilang' ? 'lost' : 'retired'; oldEquipment.status = 'maintenance'; oldEquipment.updated_at = now;
        item.status = 'completed'; item.replacement_equipment_id = replacement.id; item.verified_by = input.actorId; item.completed_at = now; item.updated_at = now;
        return { data: replacement, error: null };
      }
      const result = await configuredClient.rpc('register_equipment_replacement_atomic', {
        p_case_id: input.caseId, p_equipment_code: input.equipmentCode, p_name: input.name, p_category: input.category,
        p_storage_location: input.storageLocation || null, p_serial_number: input.serialNumber || null, p_photo_urls: input.photoUrls,
        p_description: input.description || null, p_replacement_value: input.replacementValue || null, p_created_by: input.actorId, p_change_reason: input.changeReason,
      });
      const error = databaseError(result.error); const id = rpcId(result.data);
      if (error || !id) return { data: null, error: error || { code: 'RECOVERY_REPLACEMENT_FAILED', message: 'Pendaftaran alat pengganti gagal disimpan.' } };
      const equipment = await configuredClient.from('equipment').select(EQUIPMENT_SELECT).eq('id', id).single();
      const equipmentError = databaseError(equipment.error);
      return { data: equipmentError || !equipment.data ? null : mapEquipmentRow(equipment.data as unknown as Record<string, unknown>), error: equipmentError };
    },

    async listCharges(params) {
      if (!configuredClient) return { data: recoveryState.charges.filter((item) => (!params?.studentId || item.student_id === params.studentId) && (!params?.status || item.status === params.status)).slice(0, CHARGE_LIST_LIMIT), error: null };
      let query = configuredClient.from('equipment_charge_settlements').select(CHARGE_SETTLEMENT_SELECT).order('created_at', { ascending: false }).limit(CHARGE_LIST_LIMIT);
      if (params?.studentId) query = query.eq('student_id', params.studentId); if (params?.status) query = query.eq('status', params.status);
      const result = await query; const error = databaseError(result.error);
      return { data: error ? [] : ((result.data || []) as Array<Record<string, unknown>>).map(mapCharge), error };
    },

    async recordChargePayment(input) {
      if (!configuredClient) {
        const charge = recoveryState.charges.find((item) => item.id === input.settlementId); if (!charge) return { data: null, error: { code: 'CHARGE_SETTLEMENT_NOT_FOUND', message: 'Tagihan alat tidak ditemukan.' } };
        charge.paid_amount = input.status === 'waived' ? 0 : input.paidAmount; charge.status = input.status; charge.notes = input.notes; charge.recorded_by = input.actorId; charge.updated_at = new Date().toISOString(); return { data: { ...charge }, error: null };
      }
      const result = await configuredClient.rpc('record_equipment_charge_payment_atomic', {
        p_settlement_id: input.settlementId, p_paid_amount: input.paidAmount, p_status: input.status, p_notes: input.notes || null, p_recorded_by: input.actorId, p_change_reason: input.changeReason,
      });
      const error = databaseError(result.error); const id = rpcId(result.data);
      if (error || !id) return { data: null, error: error || { code: 'CHARGE_PAYMENT_FAILED', message: 'Pembayaran tagihan gagal disimpan.' } };
      const charge = await configuredClient.from('equipment_charge_settlements').select(CHARGE_SETTLEMENT_SELECT).eq('id', id).single(); const chargeError = databaseError(charge.error);
      return { data: chargeError || !charge.data ? null : mapCharge(charge.data as Record<string, unknown>), error: chargeError };
    },

    async reserveChargeEvidence(input: ChargeEvidenceUploadInput) {
      if (!configuredClient) {
        const charge = recoveryState.charges.find((item) => item.id === input.settlementId);
        if (!charge) return { data: null, error: { code: 'CHARGE_SETTLEMENT_NOT_FOUND', message: 'Tagihan alat tidak ditemukan.' } };
        if (charge.status === 'waived' || charge.paid_amount >= charge.amount) return { data: null, error: { code: 'CHARGE_AMOUNT_INVALID', message: 'Tagihan ini sudah diselesaikan.' } };
        const now = new Date().toISOString();
        const evidence: EquipmentEvidenceRecord = {
          id: crypto.randomUUID(), settlement_id: input.settlementId, evidence_type: input.evidenceType,
          object_key: input.objectKey, storage_provider: 'r2', mime_type: input.mimeType,
          file_size_bytes: input.fileSizeBytes, original_filename: input.originalFilename,
          upload_status: 'pending', created_by: input.actorId, created_at: now, updated_at: now,
        };
        recoveryState.evidence.unshift(evidence);
        return { data: evidence, error: null };
      }
      const result = await configuredClient.rpc('reserve_equipment_charge_evidence_atomic', {
        p_settlement_id: input.settlementId, p_evidence_type: input.evidenceType, p_object_key: input.objectKey,
        p_mime_type: input.mimeType, p_file_size_bytes: input.fileSizeBytes, p_original_filename: input.originalFilename,
        p_created_by: input.actorId,
      });
      const error = databaseError(result.error);
      const id = rpcId(result.data);
      if (error || !id) return { data: null, error: error || { code: 'CHARGE_EVIDENCE_RESERVATION_FAILED', message: 'Bukti pembayaran gagal disiapkan.' } };
      const evidence = await configuredClient.from('equipment_evidence').select(CHARGE_EVIDENCE_SELECT).eq('id', id).single();
      const evidenceError = databaseError(evidence.error);
      return { data: evidenceError || !evidence.data ? null : mapEvidence(evidence.data as Record<string, unknown>), error: evidenceError };
    },

    async getChargeEvidence(evidenceId: string) {
      if (!configuredClient) return { data: recoveryState.evidence.find((item) => item.id === evidenceId) || null, error: null };
      const result = await configuredClient.from('equipment_evidence').select(CHARGE_EVIDENCE_SELECT).eq('id', evidenceId).maybeSingle();
      const error = databaseError(result.error);
      return { data: error || !result.data ? null : mapEvidence(result.data as Record<string, unknown>), error };
    },

    async listChargeEvidence(settlementId: string) {
      if (!configuredClient) return { data: recoveryState.evidence.filter((item) => item.settlement_id === settlementId && item.upload_status === 'attached').slice(0, CHARGE_EVIDENCE_LIST_LIMIT), error: null };
      const result = await configuredClient.from('equipment_evidence').select(CHARGE_EVIDENCE_SELECT).eq('settlement_id', settlementId).eq('upload_status', 'attached').order('created_at', { ascending: false }).limit(CHARGE_EVIDENCE_LIST_LIMIT);
      const error = databaseError(result.error);
      return { data: error ? [] : ((result.data || []) as Array<Record<string, unknown>>).map(mapEvidence), error };
    },

    async recordChargePaymentEvent(input: ChargePaymentEventInput) {
      if (!configuredClient) {
        const charge = recoveryState.charges.find((item) => item.id === input.settlementId);
        if (!charge) return { data: null, error: { code: 'CHARGE_SETTLEMENT_NOT_FOUND', message: 'Tagihan alat tidak ditemukan.' } };
        if (charge.status === 'waived' || charge.paid_amount >= charge.amount) return { data: null, error: { code: 'CHARGE_AMOUNT_INVALID', message: 'Tagihan ini sudah diselesaikan.' } };
        const remaining = charge.amount - charge.paid_amount;
        if (input.paymentAmount <= 0 || input.paymentAmount > remaining) return { data: null, error: { code: 'CHARGE_AMOUNT_INVALID', message: 'Jumlah pembayaran melebihi sisa tagihan.' } };
        const evidence = input.evidenceIds.map((id) => recoveryState.evidence.find((item) => item.id === id));
        if (evidence.some((item) => !item || item.settlement_id !== charge.id || item.created_by !== input.actorId || item.upload_status !== 'pending')) return { data: null, error: { code: 'CHARGE_EVIDENCE_INVALID', message: 'Bukti pembayaran tidak valid.' } };
        if (!evidence.some((item) => item?.evidence_type === 'payment')) return { data: null, error: { code: 'CHARGE_EVIDENCE_REQUIRED', message: 'Bukti pembayaran wajib diunggah.' } };
        const nextPaid = charge.paid_amount + input.paymentAmount;
        const activeCase = recoveryState.cases.find((item) => item.assessment_item_id === charge.assessment_item_id && ['open', 'in_progress', 'awaiting_verification'].includes(item.status));
        if (nextPaid >= charge.amount && activeCase) {
          const minimum = activeCase.recovery_type === 'replacement' ? 3 : 2;
          if (evidence.filter((item) => item?.evidence_type === activeCase.recovery_type).length < minimum) return { data: null, error: { code: 'CHARGE_RESOLUTION_EVIDENCE_REQUIRED', message: `Minimal ${minimum} foto penyelesaian wajib diunggah.` } };
        }
        const now = new Date().toISOString();
        charge.paid_amount = nextPaid; charge.status = nextPaid >= charge.amount ? 'paid' : 'partial'; charge.notes = input.notes; charge.recorded_by = input.actorId; charge.updated_at = now;
        for (const item of evidence) { if (item) { item.upload_status = 'attached'; item.updated_at = now; } }
        return { data: { ...charge }, error: null };
      }
      const result = await configuredClient.rpc('record_equipment_charge_payment_event_atomic', {
        p_settlement_id: input.settlementId, p_payment_amount: input.paymentAmount, p_evidence_ids: input.evidenceIds,
        p_notes: input.notes || null, p_recorded_by: input.actorId, p_change_reason: input.changeReason,
      });
      const error = databaseError(result.error); const id = rpcId(result.data);
      if (error || !id) return { data: null, error: error || { code: 'CHARGE_PAYMENT_FAILED', message: 'Pembayaran tagihan gagal disimpan.' } };
      const charge = await configuredClient.from('equipment_charge_settlements').select(CHARGE_SETTLEMENT_SELECT).eq('id', id).single();
      const chargeError = databaseError(charge.error);
      return { data: chargeError || !charge.data ? null : mapCharge(charge.data as Record<string, unknown>), error: chargeError };
    },
  };
}
