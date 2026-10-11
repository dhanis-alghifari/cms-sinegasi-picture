import type { ActorSummary, StudentRole } from '@/shared/types/common';

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
  operation_replayed?: boolean;
  whatsapp_number?: string;
  temporary_password?: string;
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
  username: string;
  peminatan?: Peminatan;
  no_telepon?: string;
  foto_url?: string;
  role?: StudentRole;
  change_reason?: string;
}

export interface LinkExistingStudentAccountPayload extends Omit<CreateStudentPayload, 'role' | 'username'> {
  user_id: string;
}

export interface UnlinkedStudentAccount {
  id: string;
  username: string;
  nama: string;
  role: string;
}

export interface UpdateStudentPayload extends Partial<CreateStudentPayload> {
  is_active?: boolean;
}
