import { apiClient } from '@/shared/api/client';
import {
  decodeAccessControlAuditLogs,
  decodeAccessControlMatrix,
  decodeUpdatedRoleCapabilities,
} from './access-control.responses';
import type {
  AccessControlAuditLog,
  AccessControlMatrix,
  UpdateRoleCapabilitiesRequest,
} from '../types/access-control.types';
import type { UserRole } from '@/shared/types/common';

export const accessControlService = {
  async getMatrix(): Promise<AccessControlMatrix> {
    return apiClient.getParsed('/api/access-control/matrix', decodeAccessControlMatrix);
  },

  async listAuditLogs(limit = 100): Promise<AccessControlAuditLog[]> {
    const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    return apiClient.getParsed(
      `/api/access-control/audit-logs?limit=${boundedLimit}`,
      decodeAccessControlAuditLogs,
    );
  },

  async updateRoleCapabilities(role: UserRole, input: UpdateRoleCapabilitiesRequest) {
    return apiClient.putParsed(
      `/api/access-control/roles/${encodeURIComponent(role)}/capabilities`,
      input,
      decodeUpdatedRoleCapabilities,
      { changeReason: input.change_reason },
    );
  },
};
