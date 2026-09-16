export const studentByIdRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 64 },
    },
  },
} as const;

/** Shared response contract for authenticated legacy payloads. */
export const authenticatedRouteSchema = {
  response: {
    200: { type: 'object', additionalProperties: true },
    400: { type: 'object', additionalProperties: true },
    401: { type: 'object', additionalProperties: true },
    403: { type: 'object', additionalProperties: true },
    404: { type: 'object', additionalProperties: true },
    409: { type: 'object', additionalProperties: true },
    422: { type: 'object', additionalProperties: true },
    429: { type: 'object', additionalProperties: true },
    500: { type: 'object', additionalProperties: true },
    503: { type: 'object', additionalProperties: true },
  },
} as const;

export const attendanceWriteRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      student_id: { type: 'string', minLength: 1, maxLength: 64 },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      status: { type: 'string', enum: ['present', 'sick', 'excused', 'absent'] },
      class_name: { type: 'string', minLength: 1, maxLength: 80 },
      records: {
        type: 'array',
        minItems: 1,
        maxItems: 500,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['student_id', 'status'],
          properties: {
            student_id: { type: 'string', minLength: 1, maxLength: 64 },
            status: { type: 'string', enum: ['present', 'sick', 'excused', 'absent'] },
            notes: { type: 'string', maxLength: 500 },
          },
        },
      },
      notes: { type: 'string', maxLength: 500 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      idempotencyKey: { type: 'string', minLength: 8, maxLength: 128 },
    },
    anyOf: [
      { required: ['student_id', 'date', 'status'] },
      { required: ['date', 'class_name', 'records'] },
    ],
  },
} as const;

export const attendanceRosterRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    required: ['date', 'class_name'],
    properties: {
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      class_name: { type: 'string', minLength: 1, maxLength: 80 },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const attendanceBatchWriteRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['date', 'class_name', 'records'],
    properties: {
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      class_name: { type: 'string', minLength: 1, maxLength: 80 },
      records: {
        type: 'array',
        minItems: 1,
        maxItems: 500,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['student_id', 'status'],
          properties: {
            student_id: { type: 'string', minLength: 1, maxLength: 64 },
            status: { type: 'string', enum: ['present', 'sick', 'excused', 'absent'] },
            notes: { type: 'string', maxLength: 500 },
          },
        },
      },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      idempotencyKey: { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
} as const;

export const attendanceListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      class_name: { type: 'string', maxLength: 64 },
      status: { type: 'string', enum: ['all', 'present', 'sick', 'excused', 'absent'] },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      date_from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      date_to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      student_id: { type: 'string', minLength: 1, maxLength: 64 },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
      scope: { type: 'string', enum: ['own'] },
    },
  },
} as const;

export const attendanceSummaryRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      date_from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      date_to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      student_id: { type: 'string', minLength: 1, maxLength: 64 },
      class_name: { type: 'string', maxLength: 64 },
      status: { type: 'string', enum: ['all', 'present', 'sick', 'excused', 'absent'] },
      search: { type: 'string', maxLength: 100 },
      scope: { type: 'string', enum: ['own'] },
    },
  },
} as const;

export const attendanceCorrectionRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['attendance_id'],
    properties: {
      attendance_id: { type: 'string', minLength: 1, maxLength: 64 },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['status'],
    properties: {
      status: { type: 'string', minLength: 1, maxLength: 32 },
      notes: { type: 'string', maxLength: 500 },
    },
  },
} as const;
