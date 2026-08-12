export const studentDashboardSummaryRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
} as const;

export const dashboardSummaryRouteSchema = {
  response: {
    200: { type: 'object', additionalProperties: true },
    401: { type: 'object', additionalProperties: true },
    403: { type: 'object', additionalProperties: true },
    422: { type: 'object', additionalProperties: true },
    503: { type: 'object', additionalProperties: true },
  },
} as const;
