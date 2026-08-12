import type { SupabaseClient } from '@supabase/supabase-js';
import { CAPABILITY_VALUES, ROLE_CAPABILITIES, type Capability } from '../../middleware/capabilities.js';
import { USER_ROLE_VALUES, type UserRole } from '../../shared/auth/auth.types.js';
import type {
  AccessControlMemoryState,
  AccessControlMatrix,
  AccessControlRepository,
  AccessControlRepositoryResult,
  AccessControlAuditLog,
} from './access-control.types.js';

type SupabaseLike = SupabaseClient | null;

function memoryMatrix(state: AccessControlMemoryState): AccessControlMatrix {
  return {
    roles: USER_ROLE_VALUES.map((role) => ({ role, capabilities: [...state.roleCapabilities[role]] })),
    permissions: [...CAPABILITY_VALUES],
  };
}

export function createAccessControlMemoryState(): AccessControlMemoryState {
  return {
    roleCapabilities: Object.fromEntries(
      USER_ROLE_VALUES.map((role) => [role, [...ROLE_CAPABILITIES[role]]]),
    ) as Record<UserRole, Capability[]>,
  };
}

export function createAccessControlRepository(
  client: SupabaseLike,
  state: AccessControlMemoryState,
): AccessControlRepository {
  return {
    isConfigured: () => client !== null,

    async getMatrix(): Promise<AccessControlRepositoryResult<AccessControlMatrix>> {
      if (!client) return { data: memoryMatrix(state) };
      const result = await client
        .from('access_role_permissions')
        .select('role_key,permission_key')
        .order('role_key', { ascending: true })
        .order('permission_key', { ascending: true });
      if (result.error) return { error: result.error };
      const grouped = new Map<UserRole, Capability[]>();
      for (const role of USER_ROLE_VALUES) grouped.set(role, []);
      for (const row of (result.data || []) as Array<{ role_key: string; permission_key: string }>) {
        if (USER_ROLE_VALUES.includes(row.role_key as UserRole) && CAPABILITY_VALUES.includes(row.permission_key as Capability)) {
          grouped.get(row.role_key as UserRole)?.push(row.permission_key as Capability);
        }
      }
      return {
        data: {
          roles: USER_ROLE_VALUES.map((role) => ({ role, capabilities: grouped.get(role) || [] })),
          permissions: [...CAPABILITY_VALUES],
        },
      };
    },

    async getRoleCapabilities(role): Promise<AccessControlRepositoryResult<Capability[]>> {
      if (!client) return { data: [...state.roleCapabilities[role]] };
      const result = await client
        .from('access_role_permissions')
        .select('permission_key')
        .eq('role_key', role)
        .order('permission_key', { ascending: true });
      if (result.error) return { error: result.error };
      return {
        data: ((result.data || []) as Array<{ permission_key: string }>)
          .map((row) => row.permission_key)
          .filter((permission): permission is Capability => CAPABILITY_VALUES.includes(permission as Capability)),
      };
    },

    async listAuditLogs(limit = 100): Promise<AccessControlRepositoryResult<AccessControlAuditLog[]>> {
      if (!client) return { data: [] };
      const result = await client
        .from('access_control_audit_logs')
        .select('id,actor_user_id,role_key,previous_capabilities,next_capabilities,change_reason,created_at,actor_name_snapshot,actor_username_snapshot,actor_role_snapshot')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Math.min(100, Math.max(1, limit)));
      if (result.error) return { error: result.error };
      return {
        data: ((result.data || []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          actor_user_id: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
          role_key: String(row.role_key),
          previous_capabilities: Array.isArray(row.previous_capabilities) ? row.previous_capabilities.filter((value): value is Capability => CAPABILITY_VALUES.includes(value as Capability)) : [],
          next_capabilities: Array.isArray(row.next_capabilities) ? row.next_capabilities.filter((value): value is Capability => CAPABILITY_VALUES.includes(value as Capability)) : [],
          change_reason: String(row.change_reason),
          created_at: String(row.created_at),
          actor: {
            ...(typeof row.actor_user_id === 'string' ? { id: row.actor_user_id } : {}),
            ...(typeof row.actor_name_snapshot === 'string' ? { nama: row.actor_name_snapshot } : {}),
            ...(typeof row.actor_username_snapshot === 'string' ? { username: row.actor_username_snapshot } : {}),
            ...(typeof row.actor_role_snapshot === 'string' ? { role: row.actor_role_snapshot } : {}),
          },
        })),
      };
    },

    async replaceRoleCapabilities({ role, capabilities, actorUserId, changeReason }) {
      if (!client) {
        state.roleCapabilities[role] = [...capabilities];
        return { data: undefined };
      }
      const result = await client.rpc('replace_access_role_capabilities', {
        p_role_key: role,
        p_capabilities: capabilities,
        p_actor_user_id: actorUserId,
        p_change_reason: changeReason,
      });
      if (result.error) return { error: result.error };
      return { data: undefined };
    },
  };
}
