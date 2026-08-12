import { apiClient } from '@/shared/api/client';
import type { Capability } from '@/shared/auth/capabilities';
import type {
  AccessControlAuditLog,
  AccessControlMatrix,
  UpdateRoleCapabilitiesRequest,
} from '../types/access-control.types';
import type { UserRole } from '@/shared/types/common';

type Envelope<T> = { data?: T } & T;

function unwrap<T>(payload: Envelope<T>): T {
  return payload.data ?? payload as T;
}

export const accessControlService = {
  async getMatrix(): Promise<AccessControlMatrix> {
    return unwrap(await apiClient.get<Envelope<AccessControlMatrix>>('/api/access-control/matrix'));
  },

  async listAuditLogs(limit = 100): Promise<AccessControlAuditLog[]> {
    const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    return unwrap(await apiClient.get<Envelope<AccessControlAuditLog[]>>(
      `/api/access-control/audit-logs?limit=${boundedLimit}`,
    ));
  },

  async updateRoleCapabilities(role: UserRole, input: UpdateRoleCapabilitiesRequest) {
    return unwrap(await apiClient.put<Envelope<{ role: UserRole; capabilities: Capability[] }>>(
      `/api/access-control/roles/${encodeURIComponent(role)}/capabilities`,
      input,
      { changeReason: input.change_reason },
    ));
  },
};
