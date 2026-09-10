const authenticatedErrorResponses = {
  400: { type: 'object', additionalProperties: true },
  401: { type: 'object', additionalProperties: true },
  403: { type: 'object', additionalProperties: true },
  404: { type: 'object', additionalProperties: true },
  409: { type: 'object', additionalProperties: true },
  422: { type: 'object', additionalProperties: true },
  429: { type: 'object', additionalProperties: true },
  500: { type: 'object', additionalProperties: true },
  503: { type: 'object', additionalProperties: true },
} as const;

const notificationIdParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const notificationResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'user_id', 'type', 'title', 'message', 'is_read', 'created_at'],
  properties: {
    id: { type: 'string', minLength: 1 },
    user_id: { type: 'string', minLength: 1 },
    type: {
      type: 'string',
      enum: [
        'attendance_correction',
        'grade_published',
        'grade_correction',
        'borrowing_approved',
        'borrowing_rejected',
        'borrowing_overdue',
        'cash_deducted',
        'cash_dispute_response',
        'contest_assigned',
        'system_announcement',
        'password_reset',
      ],
    },
    title: { type: 'string', minLength: 1 },
    message: { type: 'string', minLength: 1 },
    link_url: { type: 'string' },
    is_read: { type: 'boolean' },
    created_at: { type: 'string', minLength: 1 },
  },
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
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'data', 'unreadCount', 'total', 'page', 'pageSize', 'totalPages'],
      properties: {
        success: { const: true },
        data: { type: 'array', items: notificationResponseSchema },
        unreadCount: { type: 'integer', minimum: 0 },
        total: { type: 'integer', minimum: 0 },
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1 },
        totalPages: { type: 'integer', minimum: 1 },
      },
    },
    ...authenticatedErrorResponses,
  },
} as const;

export const unreadCountRouteSchema = {
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['unread_count'],
      properties: { unread_count: { type: 'integer', minimum: 0 } },
    },
    ...authenticatedErrorResponses,
  },
} as const;

export const notificationIdRouteSchema = {
  params: notificationIdParams,
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'data'],
      properties: {
        success: { const: true },
        data: notificationResponseSchema,
      },
    },
    ...authenticatedErrorResponses,
  },
} as const;

export const readAllNotificationsRouteSchema = {
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'message'],
      properties: {
        success: { const: true },
        message: { type: 'string', minLength: 1 },
      },
    },
    ...authenticatedErrorResponses,
  },
} as const;
