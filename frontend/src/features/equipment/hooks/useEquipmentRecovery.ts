import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { equipmentService } from '../api/equipment.service';
import type { RecoveryType } from '../types/equipment.types';

export function useEquipmentRecoveryQuery(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EQUIPMENT_RECOVERY, 'active'],
    queryFn: () => equipmentService.getRecoveryCases({ status: 'active' }),
    enabled,
    staleTime: 15_000,
  });
}

export function useEquipmentRecoveryHistoryQuery(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EQUIPMENT_RECOVERY, 'history'],
    queryFn: () => equipmentService.getRecoveryCases({ status: 'history' }),
    enabled,
    staleTime: 30_000,
  });
}

function invalidateEquipment(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT, refetchType: 'active' }),
    client.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_SUMMARY, refetchType: 'active' }),
    client.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_RECOVERY, refetchType: 'active' }),
  ]);
}

export function useCreateEquipmentRecoveryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ equipmentId, payload }: { equipmentId: string; payload: { recovery_type: RecoveryType; reported_condition: string; notes?: string; change_reason: string } }) => equipmentService.createRecoveryCase(equipmentId, payload),
    onSuccess: () => invalidateEquipment(client),
  });
}

export function useCompleteEquipmentRepairMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { case_id: string; inspection_photos: string[]; inspection_passed: boolean; actual_cost?: number; notes?: string; change_reason: string }) => equipmentService.completeRecoveryRepair(payload),
    onSuccess: () => invalidateEquipment(client),
  });
}

export function useRegisterEquipmentReplacementMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { case_id: string; equipment_code: string; name: string; category: string; storage_location?: string; serial_number?: string; photo_urls: string[]; description?: string; replacement_value?: number; change_reason: string }) => equipmentService.registerRecoveryReplacement(payload),
    onSuccess: () => invalidateEquipment(client),
  });
}

export function useEquipmentChargesQuery(studentId?: string, enabled = true, includeAll = false) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EQUIPMENT_CHARGES, studentId ?? UI_CONSTANTS.ALL_FILTER_VALUE],
    queryFn: () => equipmentService.getEquipmentCharges({ studentId }),
    enabled: enabled && (includeAll || Boolean(studentId)),
    staleTime: 15_000,
  });
}

export function useRecordEquipmentChargePaymentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { settlement_id: string; paid_amount: number; status: 'unpaid' | 'partial' | 'paid' | 'waived'; notes?: string; change_reason: string }) => equipmentService.recordEquipmentChargePayment(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_CHARGES, refetchType: 'active' }),
  });
}

export function useRecordEquipmentChargePaymentEventMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { settlement_id: string; payment_amount: number; evidence_ids: string[]; notes?: string; change_reason: string }) => equipmentService.recordEquipmentChargePaymentEvent(payload),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_CHARGES, refetchType: 'active' }),
      client.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_RECOVERY, refetchType: 'active' }),
    ]),
  });
}
