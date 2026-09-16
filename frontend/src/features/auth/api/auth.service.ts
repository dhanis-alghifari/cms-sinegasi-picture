
import { apiClient, setToken, removeToken } from '@/shared/api/client';
import type { LoginRequest, LoginResponse, ChangePasswordRequest, ChangePasswordResponse, AuthUser } from '../types/auth.types';
import {
  decodeChangePasswordResponse,
  decodeLoginResponse,
  decodeLogoutResponse,
  decodeSessionResponse,
} from './auth.responses';

export const authService = {
  login(data: LoginRequest): Promise<LoginResponse> {
    return apiClient.postParsed('/api/auth/login', data, decodeLoginResponse);
  },

  logout(): Promise<void> {
    return apiClient.postParsed('/api/auth/logout', {}, decodeLogoutResponse, {
      changeReason: 'User logout',
    });
  },

  me(): Promise<AuthUser> {
    return apiClient.getParsed('/api/auth/me', decodeSessionResponse);
  },

  changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    return apiClient.patchParsed('/api/auth/change-password', data, decodeChangePasswordResponse, {
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
