// src/features/equipment/hooks/useEquipmentQuery.ts
// TanStack Query hooks for equipment domain

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { equipmentService } from '../api/equipment.service';
import type { EquipmentFilterParams } from '../types/equipment.types';

export function useEquipmentQuery(params?: EquipmentFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EQUIPMENT, params],
    queryFn: () => equipmentService.getEquipment(params),
  });
}

export function useEquipmentSummaryQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.EQUIPMENT_SUMMARY,
    queryFn: () => equipmentService.getSummary(),
  });
}
