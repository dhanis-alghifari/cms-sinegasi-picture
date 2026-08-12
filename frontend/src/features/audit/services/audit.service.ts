import { apiClient } from '@/shared/api/client';
import type { AuditLog, AuditLogFilterParams, AuditLogPage } from '../types/audit.types';

function toQueryString(params: AuditLogFilterParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

export const auditService = {
  getLogs(params: AuditLogFilterParams = {}) {
    const query = toQueryString({ page: 1, pageSize: 20, ...params });
    return apiClient.get<AuditLogPage>(`/api/audit-logs?${query}`);
  },

  getRecordHistory(tableName: string, recordId: string, params: AuditLogFilterParams = {}) {
    const query = toQueryString({ page: 1, pageSize: 20, ...params });
    return apiClient.get<AuditLogPage>(`/api/audit-logs/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}?${query}`);
  },

  getEntry(id: string) {
    return apiClient.get<{ success: boolean; data: AuditLog }>(`/api/audit-logs/entry/${encodeURIComponent(id)}`);
  },
};
