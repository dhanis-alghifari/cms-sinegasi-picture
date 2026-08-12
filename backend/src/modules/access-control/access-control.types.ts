import type { Capability } from '../../middleware/capabilities.js';
import type { UserRole } from '../../shared/auth/auth.types.js';

export type AccessControlMemoryState = {
  roleCapabilities: Record<UserRole, Capability[]>;
};

export type AccessControlRepositoryResult<T> =
  | { data: T; error?: never }
  | { data?: null; error: unknown };

export type AccessControlMatrix = {
  roles: Array<{ role: UserRole; capabilities: Capability[] }>;
  permissions: Capability[];
};

export type AccessControlAuditLog = {
  id: string;
  actor_user_id?: string | null;
  role_key: UserRole | string;
  previous_capabilities: Capability[];
  next_capabilities: Capability[];
  change_reason: string;
  created_at: string;
  actor?: {
    id?: string;
    nama?: string;
    username?: string;
    role?: string;
  };
};

export interface AccessControlRepository {
  isConfigured(): boolean;
  getMatrix(): Promise<AccessControlRepositoryResult<AccessControlMatrix>>;
  getRoleCapabilities(role: UserRole): Promise<AccessControlRepositoryResult<Capability[]>>;
  listAuditLogs(limit?: number): Promise<AccessControlRepositoryResult<AccessControlAuditLog[]>>;
  replaceRoleCapabilities(input: {
    role: UserRole;
    capabilities: Capability[];
    actorUserId: string | null;
    changeReason: string;
  }): Promise<AccessControlRepositoryResult<void>>;
}
