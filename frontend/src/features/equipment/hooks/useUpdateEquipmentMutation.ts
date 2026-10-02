
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { equipmentService } from '../api/equipment.service';
import type { UpdateEquipmentPayload } from '../types/equipment.types';

export function useUpdateEquipmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Perubahan data alat berhasil disimpan.' },
    mutationFn: ({
      id,
      payload,
      changeReason,
    }: {
      id: string;
      payload: UpdateEquipmentPayload;
      changeReason: string;
    }) => equipmentService.updateEquipment(id, payload, changeReason),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_DETAIL(variables.id), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EQUIPMENT_SUMMARY, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY, refetchType: 'active' }),
      ]);
    },
  });
}
