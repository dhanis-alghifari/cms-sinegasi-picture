// src/features/equipment/api/equipment.service.ts
// Pure TS equipment catalog & inventory service

import { apiClient } from '@/shared/api/client';
import {
  decodeEquipment,
  decodeEquipmentList,
  decodeEquipmentSummary,
} from './equipment.responses';
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
    return apiClient.getParsed(endpoint, decodeEquipmentList);
  },

  getSummary(): Promise<EquipmentSummary> {
    return apiClient.getParsed('/api/equipment/summary', decodeEquipmentSummary);
  },

  getEquipmentById(id: string): Promise<Equipment> {
    return apiClient.getParsed(`/api/equipment/${id}`, decodeEquipment);
  },

  createEquipment(payload: CreateEquipmentPayload): Promise<Equipment> {
    return apiClient.postParsed('/api/equipment', payload, decodeEquipment);
  },

  updateEquipment(
    id: string,
    payload: UpdateEquipmentPayload,
    changeReason: string,
  ): Promise<Equipment> {
    return apiClient.putParsed(`/api/equipment/${id}`, payload, decodeEquipment, {
      changeReason,
    });
  },

  updateCondition(
    id: string,
    payload: UpdateConditionPayload,
    changeReason: string,
  ): Promise<Equipment> {
    return apiClient.patchParsed(`/api/equipment/${id}/condition`, payload, decodeEquipment, {
      changeReason,
    });
  },
};
