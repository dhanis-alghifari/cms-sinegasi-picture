// src/features/users/services/users.service.ts
// Pure TS user management service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  UserAccount,
  UserFilterParams,
  CreateUserPayload,
  UpdateUserPayload,
  ResetPasswordResponse,
  CreateUserResponse,
  UserResponse,
} from '../types/users.types';

function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `reset-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export const usersService = {
  getUsers(params?: UserFilterParams): Promise<PaginatedResponse<UserAccount>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.role) query.append('role', params.role);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));

    const endpoint = `/api/users${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<UserAccount>>(endpoint);
  },

  async getUserById(id: string): Promise<UserAccount> {
    const response = await apiClient.get<UserResponse>(`/api/users/${id}`);
    return response.data;
  },

  createUser(payload: CreateUserPayload): Promise<CreateUserResponse> {
    return apiClient.post<CreateUserResponse>('/api/users', payload);
  },

  async updateUser(
    id: string,
    payload: UpdateUserPayload,
    changeReason: string,
  ): Promise<UserAccount> {
    const response = await apiClient.put<UserResponse>(`/api/users/${id}`, payload, {
      changeReason,
    });
    return response.data;
  },

  deleteUser(id: string, changeReason: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/api/users/${id}`, {
      changeReason,
    });
  },

  resetPassword(id: string, changeReason: string): Promise<ResetPasswordResponse> {
    return apiClient.post<ResetPasswordResponse>(
      `/api/users/${id}/reset-password`,
      {},
      { changeReason, idempotencyKey: newIdempotencyKey() },
    );
  },
};
