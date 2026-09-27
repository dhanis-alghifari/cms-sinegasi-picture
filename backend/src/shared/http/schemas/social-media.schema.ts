const idParams = {
  type: 'object', additionalProperties: false, required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

const evidenceParams = {
  type: 'object', additionalProperties: false, required: ['id', 'evidenceId'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 }, evidenceId: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

const platform = { type: 'string', enum: ['instagram', 'tiktok', 'youtube', 'whatsapp'] } as const;
const changeHeaders = {
  type: 'object', additionalProperties: true,
  required: ['x-change-reason', 'x-idempotency-key'],
  properties: {
    'x-change-reason': { type: 'string', minLength: 5, maxLength: 500 },
    'x-idempotency-key': { type: 'string', minLength: 8, maxLength: 128 },
  },
} as const;
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;
const mutationOptions = { headers: changeHeaders } as const;

export const socialAccountsListSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: { include_inactive: { type: 'string', enum: ['true', 'false'] } } },
} as const;
export const socialAccountCreateSchema = {
  ...mutationOptions,
  body: { type: 'object', additionalProperties: false, required: ['platform', 'account_name', 'account_url'], properties: { platform, account_name: { type: 'string', minLength: 2, maxLength: 120 }, account_url: { type: 'string', minLength: 12, maxLength: 500 } } },
} as const;
export const socialAccountUpdateSchema = {
  ...mutationOptions, params: idParams,
  body: { type: 'object', additionalProperties: false, required: ['expected_version'], properties: { account_name: { type: 'string', minLength: 2, maxLength: 120 }, account_url: { type: 'string', minLength: 12, maxLength: 500 }, is_active: { type: 'boolean' }, expected_version: { type: 'integer', minimum: 1 } } },
} as const;
export const socialPublicationsListSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: { from: date, to: date, platform, page: { type: 'string', pattern: '^[0-9]+$' }, pageSize: { type: 'string', pattern: '^[0-9]+$' } } },
} as const;
export const socialPublicationCreateSchema = {
  ...mutationOptions,
  body: { type: 'object', additionalProperties: false, required: ['social_account_id', 'content_type', 'caption', 'published_at'], properties: {
    social_account_id: { type: 'string', minLength: 1, maxLength: 64 }, content_type: { type: 'string', enum: ['feed', 'reel', 'story', 'video', 'short', 'community_post', 'channel_post'] },
    caption: { type: 'string', minLength: 3, maxLength: 5000 }, published_at: date, platform_url: { type: 'string', maxLength: 500 },
    agenda_activity_id: { type: 'string', maxLength: 64 }, status: { type: 'string', enum: ['draft', 'recorded'] },
  } },
} as const;
export const socialPublicationFinalizeSchema = {
  ...mutationOptions, params: idParams,
  body: { type: 'object', additionalProperties: false, required: ['status', 'expected_version'], properties: { status: { type: 'string', const: 'recorded' }, expected_version: { type: 'integer', minimum: 1 } } },
} as const;
export const socialEvidenceReserveSchema = {
  ...mutationOptions, params: idParams,
  body: { type: 'object', additionalProperties: false, required: ['file_name', 'content_type', 'file_size_bytes'], properties: {
    file_name: { type: 'string', minLength: 1, maxLength: 255 }, content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] }, file_size_bytes: { type: 'integer', minimum: 1, maximum: 5242880 },
  } },
} as const;
export const socialEvidenceCompleteSchema = { ...mutationOptions, params: evidenceParams, body: { type: 'object', additionalProperties: false } } as const;
export const socialEvidenceAccessSchema = { params: idParams } as const;
export const socialMetricsQuerySchema = { querystring: { type: 'object', additionalProperties: false, properties: { from: date, to: date } } } as const;
export const socialSnapshotCreateSchema = {
  ...mutationOptions,
  body: { type: 'object', additionalProperties: false, required: ['social_account_id', 'as_of_date', 'audience_count'], properties: {
    social_account_id: { type: 'string', minLength: 1, maxLength: 64 }, as_of_date: date, audience_count: { type: 'integer', minimum: 0, maximum: 9007199254740991 },
  } },
} as const;
export const socialInsightCreateSchema = {
  ...mutationOptions,
  body: { type: 'object', additionalProperties: false, required: ['social_account_id', 'period_start', 'period_end'], properties: {
    social_account_id: { type: 'string', minLength: 1, maxLength: 64 }, period_start: date, period_end: date,
    views: { type: 'integer', minimum: 0, maximum: 9007199254740991 }, reach: { type: 'integer', minimum: 0, maximum: 9007199254740991 },
    interactions: { type: 'integer', minimum: 0, maximum: 9007199254740991 }, profile_visits: { type: 'integer', minimum: 0, maximum: 9007199254740991 },
    published_count: { type: 'integer', minimum: 0, maximum: 2147483647 }, notes: { type: 'string', maxLength: 2000 },
  } },
} as const;
export const socialInsightFinalizeSchema = {
  ...mutationOptions, params: idParams,
  body: { type: 'object', additionalProperties: false, required: ['status', 'expected_version'], properties: { status: { type: 'string', const: 'recorded' }, expected_version: { type: 'integer', minimum: 1 } } },
} as const;
export const socialReportQuerySchema = { querystring: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: { from: date, to: date } } } as const;
