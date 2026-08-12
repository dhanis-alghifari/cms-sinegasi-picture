const notificationIdParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

export const notificationsListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
      is_read: { type: 'string', enum: ['true', 'false'] },
      unread_only: { type: 'string', enum: ['true', 'false'] },
    },
  },
} as const;

export const notificationIdRouteSchema = { params: notificationIdParams } as const;
