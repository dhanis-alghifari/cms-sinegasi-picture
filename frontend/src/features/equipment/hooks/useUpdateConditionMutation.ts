
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { equipmentService } from '../api/equipment.service';
import type { UpdateConditionPayload } from '../types/equipment.types';

export function useUpdateConditionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      changeReason,
    }: {
      id: string;
      payload: UpdateConditionPayload;
      changeReason: string;
    }) => equipmentService.updateCondition(id, payload, changeReason),
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
