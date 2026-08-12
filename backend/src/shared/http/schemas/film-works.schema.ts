export const filmWorksListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', maxLength: 32 },
    },
  },
} as const;
