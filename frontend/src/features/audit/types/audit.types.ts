import type { PaginatedResponse, UserRole } from '@/shared/types/common';

export const AUDIT_ACTION_VALUES = ['INSERT', 'UPDATE', 'DELETE', 'SYSTEM_CHECK'] as const;
export type AuditAction = typeof AUDIT_ACTION_VALUES[number];

export interface AuditActor {
  id?: string;
  nama?: string;
  username?: string;
  role?: UserRole | string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: AuditAction | string;
  table_name: string;
  record_id?: string;
  reason?: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  source?: string;
  request_id?: string;
  operation_id?: string;
  changed_fields: string[];
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  actor?: AuditActor;
}

export interface AuditLogFilterParams {
  page?: number;
  pageSize?: number;
  table_name?: string;
  action?: AuditAction;
  actor_id?: string;
  record_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export type AuditLogPage = PaginatedResponse<AuditLog>;
