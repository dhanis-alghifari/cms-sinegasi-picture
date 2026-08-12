export const AUDIT_ACTION_VALUES = ['INSERT', 'UPDATE', 'UPSERT', 'DELETE', 'SYSTEM_CHECK'] as const;
export type AuditAction = typeof AUDIT_ACTION_VALUES[number];

export type AuditListQuery = {
  page?: string;
  pageSize?: string;
  table_name?: string;
  action?: string;
  actor_id?: string;
  record_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type ParsedAuditQuery = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
  tableName?: string;
  action?: AuditAction;
  actorId?: string;
  recordId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

export type AuditPagination = Pick<ParsedAuditQuery, 'page' | 'pageSize' | 'from' | 'to'>;

export type AuditActor = {
  id?: string;
  nama?: string;
  username?: string;
  role?: string;
};

export type AuditLogRow = {
  id: string;
  user_id?: string | null;
  action: string;
  table_name: string;
  record_id?: string | null;
  change_reason?: string | null;
  created_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  source?: string | null;
  request_id?: string | null;
  operation_id?: string | null;
  changed_fields?: unknown;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  actor_name_snapshot?: string | null;
  actor_username_snapshot?: string | null;
  actor_role_snapshot?: string | null;
  actor?: AuditActor;
};

export type AuditLog = {
  id: string;
  user_id?: string;
  action: string;
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
};

export type AuditPage = {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AuditWriteInput = {
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changeReason: string;
  metadata?: Record<string, unknown>;
};

export type AuditWriteContext = {
  userId: string | null;
  requestId?: string | null;
  operationId?: string | null;
  userAgent?: string | null;
  source?: string | null;
  warn?: (payload: Record<string, unknown>, message: string) => void;
};

export type AuditRepositoryError = {
  code?: string;
  message?: string;
  details?: string;
};

export type AuditRepositoryResult<T> = {
  data: T | null;
  count?: number | null;
  error: AuditRepositoryError | null;
};

export interface AuditRepository {
  isConfigured(): boolean;
  list(query: ParsedAuditQuery): Promise<AuditRepositoryResult<AuditLogRow[]>>;
  getEntry(id: string): Promise<AuditRepositoryResult<AuditLogRow>>;
  listRecordHistory(tableName: string, recordId: string, query: ParsedAuditQuery): Promise<AuditRepositoryResult<AuditLogRow[]>>;
  persist(context: AuditWriteContext, input: AuditWriteInput): Promise<void>;
}
