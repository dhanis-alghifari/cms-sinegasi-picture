// src/features/classes/services/classes.service.ts

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  ClassOption,
  CreateClassInput,
  UpdateClassInput,
  ClassFilterParams,
} from '../types/classes.types';

export const classesService = {
  async getOptions(): Promise<ClassOption[]> {
    const res = await apiClient.get<{ success: boolean; data: ClassOption[] }>('/api/options/kelas');
    return res.data || [];
  },

  async getAdminClasses(params?: ClassFilterParams): Promise<PaginatedResponse<ClassOption>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.tingkat && params.tingkat !== 'all') query.append('tingkat', params.tingkat);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));

    const endpoint = `/api/admin/classes${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<ClassOption>>(endpoint);
  },

  async createClass(input: CreateClassInput): Promise<ClassOption> {
    const payload = { nama_kelas: input.nama_kelas, tingkat: input.tingkat };
    const res = await apiClient.post<{ success: boolean; data: ClassOption }>('/api/admin/classes', payload);
    return res.data;
  },

  async updateClass(id: string, input: UpdateClassInput): Promise<ClassOption> {
    const res = await apiClient.put<{ success: boolean; data: ClassOption }>(`/api/admin/classes/${id}`, input, {
      changeReason: input.change_reason || 'Memperbarui data kelas master',
    });
    return res.data;
  },

  async deleteClass(id: string): Promise<void> {
    await apiClient.delete(`/api/admin/classes/${id}`, {
      changeReason: 'Menonaktifkan kelas master',
    });
  },
};
