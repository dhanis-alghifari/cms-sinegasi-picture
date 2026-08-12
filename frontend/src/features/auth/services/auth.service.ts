// src/features/auth/services/auth.service.ts
// Auth HTTP service — pure TS, no React, no JSX
// Constitution: Service layer only — Page → Query/Mutation → Service → HTTP Client

import { apiClient, setToken, removeToken } from '@/shared/api/client';
import type { LoginRequest, LoginResponse, ChangePasswordRequest, ChangePasswordResponse, AuthUser } from '../types/auth.types';

export const authService = {
  login(data: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/api/auth/login', data);
  },

  logout(): Promise<void> {
    return apiClient.post<void>('/api/auth/logout', {}, {
      changeReason: 'User logout',
    });
  },

  me(): Promise<AuthUser> {
    return apiClient.get<AuthUser>('/api/auth/me');
  },

  changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    return apiClient.patch<ChangePasswordResponse>('/api/auth/change-password', data, {
      changeReason: 'Ganti password oleh pengguna',
    });
  },

  // Helpers — called by Zustand store
  persistToken(token: string): void {
    setToken(token);
  },

  clearToken(): void {
    removeToken();
  },
};
