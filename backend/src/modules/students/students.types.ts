import type { ActorSummary } from '../../shared/actors/actors.types.js';
import { STUDENT_ACCOUNT_ROLE_VALUES } from '../../shared/auth/auth.types.js';

export const STUDENT_PEMINATAN_VALUES = ['kamera', 'editing', 'naskah'] as const;
export type StudentPeminatan = typeof STUDENT_PEMINATAN_VALUES[number];

export { STUDENT_ACCOUNT_ROLE_VALUES };
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
  username: string;
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
  operation_replayed?: boolean;
};

export type StudentAccountOperationContext = {
  operationKey: string;
  changeReason: string;
  requestId?: string;
  operationId?: string;
  userAgent?: string;
};

export type StudentAccountOperationResult = {
  student: StudentRecord;
  account: StudentAccount;
};

export type UnlinkedStudentAccount = Pick<StudentAccount, 'username' | 'role'> & {
  id: string;
  nama: string;
};

export type StudentAccountLinkResult = StudentAccountOperationResult & {
  previousAccount: Pick<UnlinkedStudentAccount, 'id' | 'username' | 'nama' | 'role'>;
};

export type StudentAccountLinkInput = Pick<StudentCreateInput, 'nis' | 'nama' | 'kelas' | 'peminatan' | 'no_telepon' | 'foto_url'> & {
  userId: string;
  actorId: string;
  changeReason: string;
};

export type StudentExistingProfileLinkInput = {
  studentId: string;
  userId: string;
  actorId: string;
  changeReason: string;
};

export type StudentPurgeResult = {
  student_id: string;
  user_id: string | null;
  deleted_user: boolean;
  account_deactivated: boolean;
  deleted_attendance: number;
  deleted_debt_records: number;
  deleted_billing_transactions: number;
  deleted_equipment_charges: number;
  preserved_cash_transactions: number;
};

export type StudentsMemoryState = {
  students: StudentRecord[];
  accounts: Array<UnlinkedStudentAccount & { is_active: boolean; is_first_login: boolean }>;
};

export interface StudentRepository {
  isConfigured(): boolean;
  findByIdentifier(identifier: string): Promise<{ data: StudentLookupRecord | null; error: DatabaseError | null }>;
  findPhoto?(id: string): Promise<{ data: { foto_url: string | null } | null; error: DatabaseError | null }>;
  list?(query: StudentListQuery): Promise<{ data: StudentListResult; error?: never } | { data?: never; error: DatabaseError }>;
  listOptions?(query: StudentOptionsQuery): Promise<{ data: { data: StudentOption[]; total: number }; error?: never } | { data?: never; error: DatabaseError }>;
  listUnlinkedAccounts?(query: { search?: string; limit?: number; actorId: string }): Promise<{ data: UnlinkedStudentAccount[]; error?: never } | { data?: never; error: DatabaseError }>;
  createWithAccount?(input: StudentCreateInput & { passwordHash: string; actorId: string | null; requestFingerprint: string } & StudentAccountOperationContext): Promise<{ data: StudentAccountOperationResult; error?: never } | { data?: never; error: DatabaseError }>;
  linkExistingAccount?(input: StudentAccountLinkInput): Promise<{ data: StudentAccountLinkResult; error?: never } | { data?: never; error: DatabaseError }>;
  linkAccountToExistingProfile?(input: StudentExistingProfileLinkInput): Promise<{ data: StudentAccountLinkResult; error?: never } | { data?: never; error: DatabaseError }>;
  provisionAccount?(input: { id: string; username: string; phoneNumber: string; passwordHash: string; actorId: string; requestFingerprint: string } & StudentAccountOperationContext): Promise<{ data: StudentAccountOperationResult; error?: never } | { data?: never; error: DatabaseError }>;
  updateStatus?(input: { id: string; isActive: boolean; actorId: string | null }): Promise<{ data: StudentRecord | null; error?: never } | { data?: never; error: DatabaseError }>;
  updateProfile?(input: { id: string; changes: StudentUpdateInput; actorId: string | null; changeReason: string }): Promise<{ data: StudentRecord | null; error?: never } | { data?: never; error: DatabaseError }>;
  purge?(input: { id: string; actorId: string; changeReason: string }): Promise<{ data: StudentPurgeResult; error?: never } | { data?: never; error: DatabaseError }>;
}
import type { DatabaseError } from '../../shared/database/database.types.js';
