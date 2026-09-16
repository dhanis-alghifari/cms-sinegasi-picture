const studentIdParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const specializations = ['camera', 'editing', 'screenwriting', 'kamera', 'naskah'];

export const studentsListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      class_name: { type: 'string', enum: ['all', 'X', 'XI', 'XII'] },
      specialization: { type: 'string', enum: ['all', ...specializations] },
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
    required: ['student_number', 'name', 'class_name'],
    properties: {
      student_number: { type: 'string', minLength: 1, maxLength: 40 },
      name: { type: 'string', minLength: 2, maxLength: 120 },
      class_name: { type: 'string', minLength: 1, maxLength: 80 },
      specialization: { type: 'string', enum: specializations },
      phone_number: { type: 'string', maxLength: 40 },
      photo_url: { type: 'string', maxLength: 2_000_000 },
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
      name: { type: 'string', minLength: 2, maxLength: 120 },
      class_name: { type: 'string', minLength: 1, maxLength: 80 },
      specialization: { type: 'string', enum: specializations },
      phone_number: { type: 'string', maxLength: 40 },
      photo_url: { type: 'string', maxLength: 2_000_000 },
      is_active: { type: 'boolean' },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const studentIdRouteSchema = { params: studentIdParams } as const;
