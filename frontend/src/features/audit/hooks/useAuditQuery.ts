import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { auditService } from '../api/audit.service';
import type { AuditLogFilterParams } from '../types/audit.types';

export function useAuditLogsQuery(params: AuditLogFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.AUDIT_LOGS, params],
    queryFn: () => auditService.getLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAuditRecordHistoryQuery(
  tableName: string | undefined,
  recordId: string | undefined,
  params: AuditLogFilterParams = {},
) {
  return useQuery({
    queryKey: tableName && recordId
      ? QUERY_KEYS.AUDIT_LOG_DETAIL(tableName, recordId)
      : [...QUERY_KEYS.AUDIT_LOG_DETAIL('none', 'none')],
    queryFn: () => auditService.getRecordHistory(tableName!, recordId!, params),
    enabled: Boolean(tableName && recordId),
    staleTime: 15_000,
  });
}

export function useAuditEntryQuery(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.AUDIT_LOG_ENTRY(id || 'none'),
    queryFn: () => auditService.getEntry(id!),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}
