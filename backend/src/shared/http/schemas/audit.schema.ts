const auditQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'string', pattern: '^[0-9]+$' },
    pageSize: { type: 'string', pattern: '^[0-9]+$' },
    table_name: { type: 'string', maxLength: 128 },
    action: { type: 'string', enum: ['INSERT', 'UPDATE', 'UPSERT', 'DELETE', 'SYSTEM_CHECK'] },
    actor_id: { type: 'string', format: 'uuid' },
    record_id: { type: 'string', maxLength: 128 },
    date_from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    date_to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    search: { type: 'string', maxLength: 100 },
  },
} as const;

export const auditListRouteSchema = { querystring: auditQuery } as const;

export const auditEntryRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid', maxLength: 128 } },
  },
} as const;

export const auditHistoryRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['tableName', 'recordId'],
    properties: {
      tableName: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]{0,127}$' },
      recordId: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
  querystring: auditQuery,
} as const;
