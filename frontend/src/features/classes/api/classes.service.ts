// src/features/classes/api/classes.service.ts

import { apiClient } from '@/shared/api/client';
import { decodeVoidResponse } from '@/shared/api/responseValidation';
import {
  decodeClass,
  decodeClassList,
  decodeClassOptions,
} from './classes.responses';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  ClassRecord,
  ClassSelectorOption,
  CreateClassInput,
  UpdateClassInput,
  ClassFilterParams,
} from '../types/classes.types';

export const classesService = {
  async getOptions(): Promise<ClassSelectorOption[]> {
    return apiClient.getParsed('/api/options/kelas', decodeClassOptions);
  },

  async getAdminClasses(params?: ClassFilterParams): Promise<PaginatedResponse<ClassRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.tingkat && params.tingkat !== 'all') query.append('tingkat', params.tingkat);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));

    const endpoint = `/api/admin/classes${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeClassList);
  },

  async createClass(input: CreateClassInput): Promise<ClassRecord> {
    const payload = { nama_kelas: input.nama_kelas, tingkat: input.tingkat };
    return apiClient.postParsed('/api/admin/classes', payload, decodeClass);
  },

  async updateClass(id: string, input: UpdateClassInput): Promise<ClassRecord> {
    return apiClient.putParsed(`/api/admin/classes/${id}`, input, decodeClass, {
      changeReason: input.change_reason || 'Memperbarui data kelas master',
    });
  },

  async deleteClass(id: string): Promise<void> {
    await apiClient.deleteParsed(`/api/admin/classes/${id}`, decodeVoidResponse, {
      changeReason: 'Menonaktifkan kelas master',
    });
  },
};
