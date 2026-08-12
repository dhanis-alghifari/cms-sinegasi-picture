// src/features/auth/types/auth.types.ts
// Auth domain types

import type { UserRole } from '@/shared/types/common';
import type { Capability } from '@/shared/auth/capabilities';

export interface AuthUser {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  is_first_login: boolean;
  is_active: boolean;
  studentId?: string;
  auth_version?: number;
  capabilities?: Capability[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface ChangePasswordResponse {
  success: boolean;
  token: string;
  user: AuthUser;
  message: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
