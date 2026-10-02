
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { equipmentService } from '../api/equipment.service';
import type { CreateEquipmentPayload } from '../types/equipment.types';

export function useCreateEquipmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Alat berhasil ditambahkan.' },
    mutationFn: ({
      payload,
    }: {
      payload: CreateEquipmentPayload;
    }) => equipmentService.createEquipment(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_SUMMARY, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY, refetchType: 'active' }),
      ]);
    },
  });
}
