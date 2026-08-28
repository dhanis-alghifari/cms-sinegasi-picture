const entryParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

const contestParams = {
  type: 'object',
  additionalProperties: false,
  required: ['contestId'],
  properties: { contestId: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

export const contestEntryListRouteSchema = {
  params: contestParams,
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
      status: { type: 'string', enum: ['all', 'proses_submit', 'sudah_terkirim', 'menunggu_pengumuman', 'selesai'] },
    },
  },
} as const;

export const contestEntryCreateRouteSchema = {
  params: contestParams,
  body: {
    type: 'object',
    additionalProperties: false,
    anyOf: [
      { required: ['work_id'] },
      { required: ['work'] },
    ],
    properties: {
      work_id: { type: 'string', minLength: 1, maxLength: 64 },
      work: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'work_type_code'],
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 200 },
          work_type_code: { type: 'string', minLength: 2, maxLength: 64 },
        },
      },
    },
  },
} as const;

export const contestEntryDetailRouteSchema = {
  params: entryParams,
} as const;

export const contestEntryTransitionRouteSchema = {
  params: entryParams,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'change_reason'],
    properties: {
      status: { type: 'string', enum: ['sudah_terkirim', 'menunggu_pengumuman'] },
      evidence_id: { type: 'string', minLength: 1, maxLength: 64 },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const contestEvidenceUploadRouteSchema = {
  params: entryParams,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['target_status', 'file_name', 'content_type', 'file_size_bytes'],
    properties: {
      target_status: { type: 'string', enum: ['sudah_terkirim', 'selesai'] },
      file_name: { type: 'string', minLength: 1, maxLength: 255 },
      content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
      file_size_bytes: { type: 'integer', minimum: 1, maximum: 5242880 },
    },
  },
} as const;

export const contestEntryFinalizeRouteSchema = {
  params: entryParams,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['outcome_status', 'results', 'evidence_id', 'change_reason'],
    properties: {
      outcome_status: { type: 'string', enum: ['awarded', 'not_awarded'] },
      evidence_id: { type: 'string', minLength: 1, maxLength: 64 },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
      results: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['result_kind', 'result_title'],
          properties: {
            result_kind: { type: 'string', enum: ['rank', 'finalist', 'nominee', 'other'] },
            result_title: { type: 'string', minLength: 2, maxLength: 200 },
            position: { anyOf: [{ type: 'integer', minimum: 1, maximum: 100000 }, { type: 'null' }] },
          },
        },
      },
    },
  },
} as const;

export const contestEvidenceAccessRouteSchema = {
  params: entryParams,
} as const;
