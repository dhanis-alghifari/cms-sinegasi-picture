const entryParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

export const contestAchievementListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      result_kind: { type: 'string', enum: ['rank', 'top_n', 'special_award', 'finalist', 'nominee', 'honorable_mention', 'other'] },
      position: { type: 'string', pattern: '^[0-9]+$' },
      outcome_status: { type: 'string', enum: ['pending', 'awarded', 'not_awarded'] },
      event_year: { type: 'string', pattern: '^[0-9]{4}$' },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const contestAchievementDetailRouteSchema = {
  params: entryParams,
} as const;

export const contestAchievementRecordRouteSchema = {
  params: entryParams,
  headers: {
    type: 'object',
    properties: { 'x-idempotency-key': { type: 'string', minLength: 8, maxLength: 128 } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['outcome_status', 'results', 'change_reason'],
    properties: {
      outcome_status: { type: 'string', enum: ['pending', 'awarded', 'not_awarded'] },
      results: {
        type: 'array', maxItems: 20,
        items: {
          type: 'object', additionalProperties: false, required: ['result_kind', 'result_title'],
          properties: {
            result_kind: { type: 'string', enum: ['rank', 'top_n', 'special_award', 'finalist', 'nominee', 'honorable_mention', 'other'] },
            result_title: { type: 'string', minLength: 2, maxLength: 200 },
            position: { anyOf: [{ type: 'integer', minimum: 1, maximum: 100000 }, { type: 'null' }] },
            category_name: { type: 'string', maxLength: 160 },
            notes: { type: 'string', maxLength: 2000 },
          },
        },
      },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      evidence_url: { type: 'string', maxLength: 900000 },
    },
  },
} as const;
