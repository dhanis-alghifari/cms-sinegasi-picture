/** Fastify schemas for the contest achievement API. */

const contestScopeValues = ['bekasi', 'jabodetabek', 'west_java', 'national', 'general'] as const;

const contestFields = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  contest_type: { type: 'string', minLength: 1, maxLength: 120 },
  level: { type: 'string', minLength: 1, maxLength: 32 },
  date: { type: 'string', minLength: 10, maxLength: 10 },
  status: { type: 'string', minLength: 1, maxLength: 32 },
  result: { type: ['string', 'null'], maxLength: 500 },
  contest_name: { type: 'string', minLength: 1, maxLength: 200 },
  organizer: { type: 'string', minLength: 1, maxLength: 120 },
  city: { type: 'string', minLength: 2, maxLength: 120 },
  scope: { type: 'string', enum: contestScopeValues },
  deadline: { type: 'string', minLength: 10, maxLength: 10 },
  event_year: { type: 'integer', minimum: 1900, maximum: 2200 },
  website_url: { type: ['string', 'null'], maxLength: 2048 },
  description: { type: ['string', 'null'], maxLength: 2000 },
  planned_work_count: { type: ['integer', 'null'], minimum: 1, maximum: 1000 },
  academic_year: { type: 'string', pattern: '^[0-9]{4}$' },
  change_reason: { type: 'string', maxLength: 500 },
  idempotencyKey: { type: 'string', minLength: 8, maxLength: 128 },
  idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
};

export const contestListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', maxLength: 32 },
      scope: { type: 'string', enum: ['all', ...contestScopeValues] },
      event_year: { type: 'string', pattern: '^[0-9]{4}$' },
      search: { type: 'string', maxLength: 100 },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const contestWinRateRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      year: { type: 'string', pattern: '^[0-9]{4}$' },
    },
  },
} as const;

export const contestCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    anyOf: [
      { required: ['name', 'contest_type', 'level', 'date'] },
      { required: ['contest_name', 'city', 'scope', 'status', 'event_year', 'deadline'] },
    ],
    properties: contestFields,
  },
} as const;

export const contestUpdateRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      ...contestFields,
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const contestSubmissionRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    anyOf: [
      { required: ['contest_id', 'film_id'] },
      { required: ['contest_id', 'film_title', 'video_url', 'award_status'] },
    ],
    properties: {
      contest_id: { type: 'string', minLength: 1, maxLength: 64 },
      film_id: { type: 'string', minLength: 1, maxLength: 64 },
      film_title: { type: 'string', minLength: 1, maxLength: 200 },
      director_id: { type: 'string', minLength: 1, maxLength: 64 },
      crew_members: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 1, maxLength: 120 } },
      video_url: { type: 'string', minLength: 1, maxLength: 2048 },
      award_status: { type: 'string', enum: ['first_place', 'second_place', 'third_place', 'honorable_mention', 'finalist', 'participant'] },
      certificate_url: { type: ['string', 'null'], maxLength: 2048 },
      change_reason: { type: 'string', maxLength: 500 },
      idempotencyKey: { type: 'string', minLength: 8, maxLength: 128 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
} as const;
