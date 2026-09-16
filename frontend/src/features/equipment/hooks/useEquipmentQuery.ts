
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { equipmentService } from '../api/equipment.service';
import type { EquipmentFilterParams, EquipmentReportParams } from '../types/equipment.types';

export function useEquipmentQuery(params?: EquipmentFilterParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EQUIPMENT, params],
    queryFn: () => equipmentService.getEquipment(params),
    enabled,
  });
}

export function useEquipmentSummaryQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.EQUIPMENT_SUMMARY,
    queryFn: () => equipmentService.getSummary(),
  });
}

export function useEquipmentReportQuery(params: EquipmentReportParams, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EQUIPMENT_REPORT, params],
    queryFn: () => equipmentService.getReport(params),
    enabled,
    staleTime: 30_000,
  });
}
