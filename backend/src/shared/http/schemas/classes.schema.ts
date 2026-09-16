const classIdParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const classLevels = ['X', 'XI', 'XII'];

export const classesOptionsRouteSchema = {
  response: {
    200: {
      type: 'object',
      required: ['success', 'data'],
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          maxItems: 500,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'nama_kelas', 'tingkat'],
            properties: {
              id: { type: 'string', minLength: 1, maxLength: 128 },
              nama_kelas: { type: 'string', minLength: 1, maxLength: 120 },
              tingkat: { type: 'string', enum: classLevels },
            },
          },
        },
      },
    },
  },
} as const;

export const classesListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      level: { type: 'string', enum: ['all', ...classLevels] },
      is_active: { type: 'string', enum: ['all', 'true', 'false'] },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const classIdRouteSchema = { params: classIdParams } as const;

export const classCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'level'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      level: { type: 'string', enum: classLevels },
    },
  },
} as const;

export const classUpdateRouteSchema = {
  params: classIdParams,
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      level: { type: 'string', enum: classLevels },
      is_active: { type: 'boolean' },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;
