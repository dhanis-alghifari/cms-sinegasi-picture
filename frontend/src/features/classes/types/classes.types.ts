// src/features/classes/types/classes.types.ts
import type { ActorSummary } from '@/shared/types/common';

export interface ClassOption {
  id: string;
  nama_kelas: string;
  tingkat: 'X' | 'XI' | 'XII' | string;
  is_active: boolean;
  created_at?: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface CreateClassInput {
  nama_kelas: string;
  tingkat: string;
  change_reason?: string;
}

export interface UpdateClassInput {
  nama_kelas?: string;
  tingkat?: string;
  is_active?: boolean;
  change_reason?: string;
}

export interface ClassFilterParams {
  search?: string;
  tingkat?: string;
  is_active?: boolean;
  page?: number;
  pageSize?: number;
}
