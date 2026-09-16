import type { ActorSummary } from '@/shared/types/common';

export type ClassLevel = 'X' | 'XI' | 'XII' | string;

/**
 * Small projection used by selectors such as the student and attendance forms.
 * Keep this separate from the administrative class record because the options
 * endpoint intentionally does not return audit or status fields.
 */
export interface ClassSelectorOption {
  id: string;
  nama_kelas: string;
  tingkat: ClassLevel;
}

/**
 * Complete class record returned by the administrative classes endpoints.
 */
export interface ClassRecord extends ClassSelectorOption {
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
