// src/features/students/types/students.types.ts
// Student domain types according to PRD schema
import type { ActorSummary } from '@/shared/types/common';

export const PEMINATAN_VALUES = ['kamera', 'editing', 'naskah'] as const;
export type Peminatan = typeof PEMINATAN_VALUES[number];

export interface Student {
  id: string;
  user_id?: string;
  nis: string;
  nama: string;
  kelas: string;
  peminatan?: Peminatan;
  no_telepon?: string;
  foto_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

/** Minimal projection used by searchable student pickers. */
export interface StudentOption {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  label: string;
  secondaryLabel: string;
}

export interface StudentAccountCredentials {
  user_id?: string;
  username: string;
  role: string;
  is_first_login: boolean;
  temporary_password: string;
}

export interface StudentAccountResponse {
  success: boolean;
  data: Student;
  account: StudentAccountCredentials;
}

export interface StudentFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  kelas?: string;
  peminatan?: Peminatan;
  is_active?: boolean;
}

export interface CreateStudentPayload {
  nis: string;
  nama: string;
  kelas: string;
  peminatan?: Peminatan;
  no_telepon?: string;
  foto_url?: string;
  change_reason?: string;
}

export interface UpdateStudentPayload extends Partial<CreateStudentPayload> {
  is_active?: boolean;
}
