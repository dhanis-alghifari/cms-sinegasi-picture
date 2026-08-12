import { USER_ROLE_VALUES, type UserRole } from '../../shared/auth/auth.types.js';
import type { ActorSummary } from '../../shared/actors/actors.types.js';

export { USER_ROLE_VALUES };
export type { UserRole };

export type UserAccount = {
  id: string;
  username: string;
  nama: string;
  role: UserRole | string;
  is_first_login: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
};

export type LinkedStudent = {
  id: string;
  nama?: string;
  is_active: boolean;
};

export type UserListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
};

export type UserListResult = {
  data: UserAccount[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type UserCreateInput = {
  username: string;
  nama: string;
  role: string;
  password: string;
};

export type UserUpdateInput = {
  username?: string;
  nama?: string;
  role?: string;
  is_active?: boolean;
};

export type UserMutationResult = {
  data: UserAccount;
  previous?: UserAccount;
};

export type RepositoryResult<T> = { data: T } | { error: unknown };

export type PasswordResetAuditContext = {
  requestId?: string | null;
  operationId?: string | null;
};

export type UserUpdateAuditContext = {
  requestId?: string | null;
  operationId?: string | null;
};

export type UserMemoryState = {
  users: UserAccount[];
  linkedStudents: LinkedStudent[];
  passwordHashes: Map<string, string>;
  passwordResetOperations: Set<string>;
};

export interface UsersRepository {
  isConfigured(): boolean;
  list(query: UserListQuery): Promise<RepositoryResult<UserListResult>>;
  findById(id: string): Promise<RepositoryResult<UserAccount | null>>;
  findLinkedStudent(id: string): Promise<RepositoryResult<LinkedStudent | null>>;
  create(input: { username: string; nama: string; role: string; passwordHash: string; actorId: string | null }): Promise<RepositoryResult<UserAccount>>;
  update(
    id: string,
    changes: UserUpdateInput,
    actorId: string | null,
    changeReason: string,
    auditContext?: UserUpdateAuditContext,
  ): Promise<RepositoryResult<UserAccount | null>>;
  remove(id: string): Promise<RepositoryResult<boolean>>;
  resetPassword(
    id: string,
    passwordHash: string,
    actorId: string | null,
    changeReason: string,
    operationKey: string,
    auditContext?: PasswordResetAuditContext,
  ): Promise<RepositoryResult<UserAccount | null>>;
}
