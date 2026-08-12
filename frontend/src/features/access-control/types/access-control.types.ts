import type { Capability } from '@/shared/auth/capabilities';
import type { UserRole } from '@/shared/types/common';

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
    role?: UserRole | string;
  };
};

export type UpdateRoleCapabilitiesRequest = {
  capabilities: Capability[];
  change_reason: string;
};
