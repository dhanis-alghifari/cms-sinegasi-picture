import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid, redactAuditValues, sanitizeAuditSearch } from './audit.helpers.js';
import type { AuditLogRow, AuditRepository, AuditRepositoryError, AuditWriteContext, AuditWriteInput, ParsedAuditQuery } from './audit.types.js';

type SupabaseLike = SupabaseClient | null;
type DateFilterQuery = {
  gte(column: string, value: string): DateFilterQuery;
  lte(column: string, value: string): DateFilterQuery;
};
type SearchFilterQuery = DateFilterQuery & {
  or(filters: string): SearchFilterQuery;
};

const AUDIT_LIST_SELECT = 'id,user_id,action,table_name,record_id,change_reason,created_at,ip_address,user_agent,source,request_id,operation_id,changed_fields,actor_name_snapshot,actor_username_snapshot,actor_role_snapshot';
const AUDIT_DETAIL_SELECT = `${AUDIT_LIST_SELECT},old_values,new_values,metadata`;

function toError(error: unknown): AuditRepositoryError | null {
  if (!error) return null;
  const candidate = error as AuditRepositoryError;
  return { code: candidate.code, message: candidate.message, details: candidate.details };
}

async function attachAuditActors(client: SupabaseLike, rows: AuditLogRow[]): Promise<AuditLogRow[]> {
  if (!client || rows.length === 0) return rows;

  const ids = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => isUuid(id || undefined)))];
  if (ids.length === 0) return rows;

  const { data } = await client
    .from('users')
    .select('id,nama,username,role')
    .in('id', ids);
  const actorMap = new Map((data || []).map((actor) => [actor.id, actor]));

  return rows.map((row) => ({
    ...row,
    ...(row.old_values == null ? {} : { old_values: redactAuditValues(row.old_values) as Record<string, unknown> }),
    ...(row.new_values == null ? {} : { new_values: redactAuditValues(row.new_values) as Record<string, unknown> }),
    actor: {
      id: row.user_id || undefined,
      nama: row.actor_name_snapshot || (row.user_id ? actorMap.get(row.user_id)?.nama : undefined) || 'Aktor tidak diketahui',
      username: row.actor_username_snapshot || (row.user_id ? actorMap.get(row.user_id)?.username : undefined),
      role: row.actor_role_snapshot || (row.user_id ? actorMap.get(row.user_id)?.role : undefined),
    },
  }));
}

function applyDateFilters<T extends DateFilterQuery>(query: T, parsed: ParsedAuditQuery): T {
  let next = query;
  if (parsed.dateFrom) next = next.gte('created_at', `${parsed.dateFrom}T00:00:00.000Z`) as T;
  if (parsed.dateTo) next = next.lte('created_at', `${parsed.dateTo}T23:59:59.999Z`) as T;
  return next as T;
}

function applySearch<T extends SearchFilterQuery>(query: T, search: string | undefined): T {
  const safeSearch = search ? sanitizeAuditSearch(search) : '';
  if (!safeSearch) return query;
  return query.or([
    `table_name.ilike.%${safeSearch}%`,
    `action.ilike.%${safeSearch}%`,
    `change_reason.ilike.%${safeSearch}%`,
    `actor_name_snapshot.ilike.%${safeSearch}%`,
    `actor_username_snapshot.ilike.%${safeSearch}%`,
  ].join(',')) as T;
}

export function createAuditRepository(client: SupabaseLike): AuditRepository {
  return {
    isConfigured: () => client !== null,

    async list(parsed) {
      if (!client) return { data: null, count: 0, error: { code: 'DATABASE_UNAVAILABLE' } };
      let query = client
        .from('activity_logs')
        .select(AUDIT_LIST_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(parsed.from, parsed.to);
      if (parsed.tableName) query = query.eq('table_name', parsed.tableName);
      if (parsed.action) query = query.eq('action', parsed.action);
      if (parsed.actorId) query = query.eq('user_id', parsed.actorId);
      if (parsed.recordId) query = query.eq('record_id', parsed.recordId);
      query = applyDateFilters(query, parsed);
      query = applySearch(query, parsed.search);
      const result = await query;
      return {
        data: await attachAuditActors(client, (result.data || []) as AuditLogRow[]),
        count: result.count ?? 0,
        error: toError(result.error),
      };
    },

    async getEntry(id) {
      if (!client) return { data: null, error: { code: 'DATABASE_UNAVAILABLE' } };
      const result = await client
        .from('activity_logs')
        .select(AUDIT_DETAIL_SELECT)
        .eq('id', id)
        .maybeSingle();
      const rows = result.data ? await attachAuditActors(client, [result.data as AuditLogRow]) : [];
      return { data: rows[0] || null, error: toError(result.error) };
    },

    async listRecordHistory(tableName, recordId, parsed) {
      if (!client) return { data: null, count: 0, error: { code: 'DATABASE_UNAVAILABLE' } };
      let query = client
        .from('activity_logs')
        .select(AUDIT_DETAIL_SELECT, { count: 'exact' })
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(parsed.from, parsed.to);
      if (parsed.action) query = query.eq('action', parsed.action);
      query = applyDateFilters(query, parsed);
      const result = await query;
      return {
        data: await attachAuditActors(client, (result.data || []) as AuditLogRow[]),
        count: result.count ?? 0,
        error: toError(result.error),
      };
    },

    async persist(context: AuditWriteContext, input: AuditWriteInput) {
      if (!client || input.changeReason.trim().length < 5) return;
      if (!context.userId) return;
      const { error } = await client.rpc('write_audit_log', {
        p_user_id: context.userId,
        p_action: input.action,
        p_table_name: input.tableName,
        p_record_id: isUuid(input.recordId || undefined) ? input.recordId : null,
        p_old_values: input.oldValues || null,
        p_new_values: input.newValues || null,
        p_change_reason: input.changeReason.trim(),
        p_request_id: context.requestId || null,
        p_operation_id: context.operationId || null,
        p_source: context.source || 'api',
        p_user_agent: context.userAgent || null,
        p_metadata: input.metadata || {},
      });

      if (error) context.warn?.({ error, tableName: input.tableName }, 'Audit log write failed');
    },
  };
}
