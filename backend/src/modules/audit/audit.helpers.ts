import { AUDIT_ACTION_VALUES, type AuditAction, type AuditListQuery, type AuditLog, type AuditLogRow, type AuditPagination, type ParsedAuditQuery } from './audit.types.js';

export const AUDIT_PAGE_SIZE_DEFAULT = 20;
export const AUDIT_PAGE_SIZE_MIN = 10;
export const AUDIT_PAGE_SIZE_MAX = 100;
export const AUDIT_PAGE_MAX = 10_000;

export function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value));
}

export function sanitizeAuditSearch(value: string): string {
  return value
    .trim()
    .replace(/[%,_().\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

const SENSITIVE_AUDIT_KEYS = new Set([
  'password', 'password_hash', 'token', 'access_token', 'refresh_token',
  'secret', 'api_key', 'apikey', 'authorization', 'cookie',
]);

/** Defense-in-depth for legacy rows created before database redaction existed. */
export function redactAuditValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactAuditValues(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    SENSITIVE_AUDIT_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactAuditValues(child),
  ]));
}

function textFilter(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

function dateFilter(value: unknown): string | undefined {
  const normalized = textFilter(value, 10);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
}

export function parseAuditPagination(query: AuditListQuery): AuditPagination {
  const rawPage = Number.parseInt(query.page || '', 10);
  const rawPageSize = Number.parseInt(query.pageSize || '', 10);
  const page = Math.min(AUDIT_PAGE_MAX, Math.max(1, Number.isFinite(rawPage) ? rawPage : 1));
  const pageSize = Math.min(
    AUDIT_PAGE_SIZE_MAX,
    Math.max(AUDIT_PAGE_SIZE_MIN, Number.isFinite(rawPageSize) ? rawPageSize : AUDIT_PAGE_SIZE_DEFAULT),
  );
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export class AuditQueryValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'AuditQueryValidationError';
  }
}

export function normalizeAuditQuery(query: AuditListQuery): ParsedAuditQuery {
  const pagination = parseAuditPagination(query);
  const actionValue = textFilter(query.action, 32)?.toUpperCase();
  if (actionValue && !AUDIT_ACTION_VALUES.includes(actionValue as AuditAction)) {
    throw new AuditQueryValidationError('action', 'Filter aksi audit tidak valid.');
  }

  const actorId = textFilter(query.actor_id, 128);
  if (actorId && !isUuid(actorId)) {
    throw new AuditQueryValidationError('actor_id', 'ID aktor audit tidak valid.');
  }

  const dateFrom = dateFilter(query.date_from);
  const dateTo = dateFilter(query.date_to);
  if (query.date_from && !dateFrom) throw new AuditQueryValidationError('date_from', 'Tanggal awal audit tidak valid.');
  if (query.date_to && !dateTo) throw new AuditQueryValidationError('date_to', 'Tanggal akhir audit tidak valid.');
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new AuditQueryValidationError('date_range', 'Rentang tanggal audit tidak valid.');
  }

  const search = textFilter(query.search, 100);
  const sanitizedSearch = search ? sanitizeAuditSearch(search) : undefined;
  return {
    ...pagination,
    tableName: textFilter(query.table_name, 128),
    action: actionValue as AuditAction | undefined,
    actorId,
    recordId: textFilter(query.record_id, 128),
    dateFrom,
    dateTo,
    search: sanitizedSearch || undefined,
  };
}

export function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    ...(row.user_id == null ? {} : { user_id: row.user_id }),
    action: row.action,
    table_name: row.table_name,
    ...(row.record_id == null ? {} : { record_id: row.record_id }),
    ...(row.change_reason == null ? {} : { reason: row.change_reason }),
    created_at: row.created_at,
    ...(row.ip_address == null ? {} : { ip_address: row.ip_address }),
    ...(row.user_agent == null ? {} : { user_agent: row.user_agent }),
    source: row.source || 'api',
    ...(row.request_id == null ? {} : { request_id: row.request_id }),
    ...(row.operation_id == null ? {} : { operation_id: row.operation_id }),
    changed_fields: Array.isArray(row.changed_fields) ? row.changed_fields.filter((field): field is string => typeof field === 'string') : [],
    ...(row.old_values == null ? {} : { old_values: redactAuditValues(row.old_values) as Record<string, unknown> }),
    ...(row.new_values == null ? {} : { new_values: redactAuditValues(row.new_values) as Record<string, unknown> }),
    metadata: row.metadata || {},
    actor: row.actor || {
      id: row.user_id || undefined,
      nama: row.actor_name_snapshot || 'Aktor tidak diketahui',
      ...(row.actor_username_snapshot == null ? {} : { username: row.actor_username_snapshot }),
      ...(row.actor_role_snapshot == null ? {} : { role: row.actor_role_snapshot }),
    },
  };
}

export function isMissingAuditSchemaError(error: { code?: string } | null): boolean {
  return Boolean(error && ['42P01', '42703', 'PGRST205'].includes(error.code || ''));
}

export function auditErrorMessage(error: { message?: string } | null, fallback: string): string {
  if (!error?.message) return fallback;
  const message = error.message.trim();
  if (!message || /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b|[{}]/i.test(message)) return fallback;
  return message.slice(0, 300);
}
