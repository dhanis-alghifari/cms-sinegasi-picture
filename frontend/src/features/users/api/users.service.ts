
import { apiClient } from '@/shared/api/client';
import {
  decodeCreateUserResponse,
  decodeDeleteUserResponse,
  decodeResetPasswordResponse,
  decodeUserList,
  decodeUserResponse,
} from './users.responses';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  UserAccount,
  UserFilterParams,
  CreateUserPayload,
  UpdateUserPayload,
  ResetPasswordResponse,
  CreateUserResponse,
} from '../types/users.types';

function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `reset-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function toUserRequest(payload: CreateUserPayload | UpdateUserPayload) {
  const { nama: name, ...rest } = payload;
  return { ...rest, ...(name !== undefined ? { name } : {}) };
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
    return apiClient.getParsed(endpoint, decodeUserList);
  },

  async getUserById(id: string): Promise<UserAccount> {
    const response = await apiClient.getParsed(`/api/users/${id}`, decodeUserResponse);
    return response.data;
  },

  createUser(payload: CreateUserPayload): Promise<CreateUserResponse> {
    return apiClient.postParsed('/api/users', toUserRequest(payload), decodeCreateUserResponse);
  },

  async updateUser(
    id: string,
    payload: UpdateUserPayload,
    changeReason: string,
  ): Promise<UserAccount> {
    const response = await apiClient.putParsed(`/api/users/${id}`, toUserRequest(payload), decodeUserResponse, {
      changeReason,
    });
    return response.data;
  },

  deleteUser(id: string, changeReason: string): Promise<{ success: boolean; message: string }> {
    return apiClient.deleteParsed(`/api/users/${id}`, decodeDeleteUserResponse, {
      changeReason,
    });
  },

  resetPassword(id: string, changeReason: string): Promise<ResetPasswordResponse> {
    return apiClient.postParsed(
      `/api/users/${id}/reset-password`,
      {},
      decodeResetPasswordResponse,
      { changeReason, idempotencyKey: newIdempotencyKey() },
    );
  },
};
