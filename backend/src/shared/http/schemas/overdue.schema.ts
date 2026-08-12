export const overdueCheckRouteSchema = {
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'message', 'result', 'logs'],
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string', maxLength: 300 },
        result: {
          type: 'object',
          additionalProperties: false,
          required: ['checkedCount', 'overdueCount', 'notifiedCount'],
          properties: {
            checkedCount: { type: 'integer', minimum: 0 },
            overdueCount: { type: 'integer', minimum: 0 },
            notifiedCount: { type: 'integer', minimum: 0 },
          },
        },
        logs: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'borrowingId', 'studentName', 'namaAlat', 'dueAt', 'checkedAt', 'reason'],
            properties: {
              id: { type: 'string', maxLength: 200 },
              borrowingId: { type: 'string', maxLength: 128 },
              studentName: { type: 'string', maxLength: 200 },
              namaAlat: { type: 'string', maxLength: 1000 },
              dueAt: { type: 'string', format: 'date-time' },
              checkedAt: { type: 'string', format: 'date-time' },
              reason: { type: 'string', maxLength: 2000 },
            },
          },
        },
      },
    },
  },
} as const;
