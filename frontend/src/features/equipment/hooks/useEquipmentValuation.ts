import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { equipmentService } from '../api/equipment.service';
import type { CreateEquipmentValuationPayload } from '../types/equipment.types';

export function useEquipmentValuationsQuery(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: id ? QUERY_KEYS.EQUIPMENT_VALUATIONS(id) : ['equipment', 'valuations', 'empty'],
    queryFn: () => equipmentService.getEquipmentValuations(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateEquipmentValuationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Nilai penggantian alat berhasil diperbarui.' },
    mutationFn: ({ id, payload, changeReason }: { id: string; payload: CreateEquipmentValuationPayload; changeReason: string }) =>
      equipmentService.createEquipmentValuation(id, payload, changeReason),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_DETAIL(variables.id), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_VALUATIONS(variables.id), refetchType: 'active' }),
      ]);
    },
  });
}
