
import type { ActorSummary, UserRole } from '@/shared/types/common';

export interface UserAccount {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  is_first_login: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface UserFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface CreateUserPayload {
  username: string;
  nama: string;
  role: UserRole;
  password?: string;
}

export interface CreateUserResponse {
  success: boolean;
  data: UserAccount;
  temporary_password: string;
}

export interface UserResponse {
  success: boolean;
  data: UserAccount;
}

export interface UpdateUserPayload {
  username?: string;
  nama?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface ResetPasswordPayload {
  change_reason: string;
}

export interface ResetPasswordResponse {
  message: string;
  temporary_password: string;
}
