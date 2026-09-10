import { apiClient } from '@/shared/api/client';
import { decodeAuditLogPage, decodeAuditLogResponse } from './audit.responses';
import type { AuditLogFilterParams } from '../types/audit.types';

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
    return apiClient.getParsed(`/api/audit-logs?${query}`, decodeAuditLogPage);
  },

  getRecordHistory(tableName: string, recordId: string, params: AuditLogFilterParams = {}) {
    const query = toQueryString({ page: 1, pageSize: 20, ...params });
    return apiClient.getParsed(
      `/api/audit-logs/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}?${query}`,
      decodeAuditLogPage,
    );
  },

  getEntry(id: string) {
    return apiClient.getParsed(`/api/audit-logs/entry/${encodeURIComponent(id)}`, decodeAuditLogResponse);
  },
};
