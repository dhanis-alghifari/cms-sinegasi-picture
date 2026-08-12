const studentIdParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const peminatan = ['kamera', 'editing', 'naskah'];

export const studentsListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      kelas: { type: 'string', enum: ['all', 'X', 'XI', 'XII'] },
      peminatan: { type: 'string', enum: ['all', ...peminatan] },
      is_active: { type: 'string', enum: ['all', 'true', 'false'] },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const studentsOptionsRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      q: { type: 'string', maxLength: 100 },
      limit: { type: 'string', pattern: '^[0-9]+$' },
      active: { type: 'string', enum: ['true', 'false'] },
    },
  },
} as const;

export const studentCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['nis', 'nama', 'kelas'],
    properties: {
      nis: { type: 'string', minLength: 1, maxLength: 40 },
      nama: { type: 'string', minLength: 2, maxLength: 120 },
      kelas: { type: 'string', minLength: 1, maxLength: 80 },
      peminatan: { type: 'string', enum: peminatan },
      no_telepon: { type: 'string', maxLength: 40 },
      foto_url: { type: 'string', maxLength: 2_000_000 },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const studentProvisionRouteSchema = {
  params: studentIdParams,
  body: {
    type: 'object',
    additionalProperties: false,
    properties: { change_reason: { type: 'string', minLength: 5, maxLength: 500 } },
  },
} as const;

export const studentUpdateRouteSchema = {
  params: studentIdParams,
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      nama: { type: 'string', minLength: 2, maxLength: 120 },
      kelas: { type: 'string', minLength: 1, maxLength: 80 },
      peminatan: { type: 'string', enum: peminatan },
      no_telepon: { type: 'string', maxLength: 40 },
      foto_url: { type: 'string', maxLength: 2_000_000 },
      is_active: { type: 'boolean' },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const studentIdRouteSchema = { params: studentIdParams } as const;
