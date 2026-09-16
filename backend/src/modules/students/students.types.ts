import type { ActorSummary } from '../../shared/actors/actors.types.js';

export const STUDENT_PEMINATAN_VALUES = ['kamera', 'editing', 'naskah'] as const;
export type StudentPeminatan = typeof STUDENT_PEMINATAN_VALUES[number];

export const STUDENT_ACCOUNT_ROLE_VALUES = [
  'leader',
  'vice_leader',
  'treasurer',
  'secretary',
  'equipment_team',
  'contest_team',
  'member',
] as const;
export type StudentAccountRole = typeof STUDENT_ACCOUNT_ROLE_VALUES[number];

export type StudentRecord = {
  id: string;
  user_id?: string;
  nis: string;
  nama: string;
  kelas: string;
  peminatan?: StudentPeminatan | string;
  no_telepon?: string;
  foto_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
  [key: string]: unknown;
};

export type StudentLookupRecord = Pick<StudentRecord, 'id' | 'nis' | 'nama'> & Partial<StudentRecord>;

export type StudentOption = Pick<StudentRecord, 'id' | 'nis' | 'nama' | 'kelas'> & {
  label: string;
  secondaryLabel: string;
};

export type StudentListQuery = {
  search?: string;
  kelas?: string;
  peminatan?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
};

export type StudentListResult = {
  data: StudentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type StudentOptionsQuery = {
  search?: string;
  limit?: number;
  isActive?: boolean;
};

export type StudentCreateInput = {
  nis: string;
  nama: string;
  kelas: string;
  peminatan?: string;
  no_telepon?: string;
  foto_url?: string;
  role?: StudentAccountRole | string;
};

export type StudentUpdateInput = {
  nama?: string;
  kelas?: string;
  peminatan?: string;
  no_telepon?: string;
  foto_url?: string;
  is_active?: boolean;
};

export type StudentAccount = {
  user_id: string;
  username: string;
  role: string;
  is_first_login: boolean;
};

export type StudentAccountOperationResult = {
  student: StudentRecord;
  account: StudentAccount;
};

export type StudentsMemoryState = {
  students: StudentRecord[];
};

export interface StudentRepository {
  isConfigured(): boolean;
  findByIdentifier(identifier: string): Promise<{ data: StudentLookupRecord | null; error: DatabaseError | null }>;
  list?(query: StudentListQuery): Promise<{ data: StudentListResult; error?: never } | { data?: never; error: DatabaseError }>;
  listOptions?(query: StudentOptionsQuery): Promise<{ data: { data: StudentOption[]; total: number }; error?: never } | { data?: never; error: DatabaseError }>;
  createWithAccount?(input: StudentCreateInput & { username: string; passwordHash: string; actorId: string | null }): Promise<{ data: StudentAccountOperationResult; error?: never } | { data?: never; error: DatabaseError }>;
  provisionAccount?(input: { id: string; username: string; passwordHash: string; actorId: string }): Promise<{ data: StudentAccountOperationResult; error?: never } | { data?: never; error: DatabaseError }>;
  updateStatus?(input: { id: string; isActive: boolean; actorId: string | null }): Promise<{ data: StudentRecord | null; error?: never } | { data?: never; error: DatabaseError }>;
  updateProfile?(input: { id: string; changes: StudentUpdateInput; actorId: string | null }): Promise<{ data: StudentRecord | null; error?: never } | { data?: never; error: DatabaseError }>;
}
import type { DatabaseError } from '../../shared/database/database.types.js';
