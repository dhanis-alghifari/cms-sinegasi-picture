/** Fastify schemas for the contest achievement API. */

const contestScopeValues = ['bekasi', 'jabodetabek', 'jawa_barat', 'nasional', 'umum'] as const;

const contestFields = {
  nama: { type: 'string', minLength: 1, maxLength: 200 },
  jenis: { type: 'string', minLength: 1, maxLength: 120 },
  level: { type: 'string', minLength: 1, maxLength: 32 },
  tanggal: { type: 'string', minLength: 10, maxLength: 10 },
  status: { type: 'string', minLength: 1, maxLength: 32 },
  hasil: { type: ['string', 'null'], maxLength: 500 },
  nama_lomba: { type: 'string', minLength: 1, maxLength: 200 },
  penyelenggara: { type: 'string', minLength: 1, maxLength: 120 },
  kota: { type: 'string', minLength: 2, maxLength: 120 },
  tingkat: { type: 'string', enum: contestScopeValues },
  deadline: { type: 'string', minLength: 10, maxLength: 10 },
  tahun_event: { type: 'integer', minimum: 1900, maximum: 2200 },
  website_url: { type: ['string', 'null'], maxLength: 2048 },
  deskripsi: { type: ['string', 'null'], maxLength: 2000 },
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
      tingkat: { type: 'string', enum: ['all', ...contestScopeValues] },
      tahun_event: { type: 'string', pattern: '^[0-9]{4}$' },
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
      tahun: { type: 'string', pattern: '^[0-9]{4}$' },
    },
  },
} as const;

export const contestCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    anyOf: [
      { required: ['nama', 'jenis', 'level', 'tanggal'] },
      { required: ['nama_lomba', 'kota', 'tingkat', 'status', 'tahun_event', 'deadline'] },
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
      { required: ['contest_id', 'judul_film', 'link_video', 'award_status'] },
    ],
    properties: {
      contest_id: { type: 'string', minLength: 1, maxLength: 64 },
      film_id: { type: 'string', minLength: 1, maxLength: 64 },
      judul_film: { type: 'string', minLength: 1, maxLength: 200 },
      sutradara_id: { type: 'string', minLength: 1, maxLength: 64 },
      crew_members: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 1, maxLength: 120 } },
      link_video: { type: 'string', minLength: 1, maxLength: 2048 },
      award_status: { type: 'string', minLength: 1, maxLength: 32 },
      sertifikat_url: { type: ['string', 'null'], maxLength: 2048 },
      change_reason: { type: 'string', maxLength: 500 },
      idempotencyKey: { type: 'string', minLength: 8, maxLength: 128 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
} as const;
