// src/features/equipment/api/equipment.service.ts
// Pure TS equipment catalog & inventory service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  Equipment,
  EquipmentSummary,
  EquipmentFilterParams,
  CreateEquipmentPayload,
  UpdateEquipmentPayload,
  UpdateConditionPayload,
} from '../types/equipment.types';

export const equipmentService = {
  getEquipment(params?: EquipmentFilterParams): Promise<PaginatedResponse<Equipment>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.kategori) query.append('kategori', params.kategori);
    if (params?.kondisi) query.append('kondisi', params.kondisi);
    if (params?.status) query.append('status', params.status);

    const endpoint = `/api/equipment${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<Equipment>>(endpoint);
  },

  getSummary(): Promise<EquipmentSummary> {
    return apiClient.get<EquipmentSummary>('/api/equipment/summary');
  },

  getEquipmentById(id: string): Promise<Equipment> {
    return apiClient.get<Equipment>(`/api/equipment/${id}`);
  },

  createEquipment(payload: CreateEquipmentPayload): Promise<Equipment> {
    return apiClient.post<Equipment>('/api/equipment', payload);
  },

  updateEquipment(
    id: string,
    payload: UpdateEquipmentPayload,
    changeReason: string,
  ): Promise<Equipment> {
    return apiClient.put<Equipment>(`/api/equipment/${id}`, payload, {
      changeReason,
    });
  },

  updateCondition(
    id: string,
    payload: UpdateConditionPayload,
    changeReason: string,
  ): Promise<Equipment> {
    return apiClient.patch<Equipment>(`/api/equipment/${id}/condition`, payload, {
      changeReason,
    });
  },
};
