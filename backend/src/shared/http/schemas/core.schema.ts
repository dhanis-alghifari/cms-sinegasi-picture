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
    required: ['student_id', 'tanggal', 'status'],
    properties: {
      student_id: { type: 'string', minLength: 1, maxLength: 64 },
      tanggal: { type: 'string', minLength: 10, maxLength: 10 },
      status: { type: 'string', minLength: 1, maxLength: 32 },
      keterangan: { type: 'string', maxLength: 500 },
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
      kelas: { type: 'string', maxLength: 64 },
      status: { type: 'string', maxLength: 32 },
      tanggal: { type: 'string', minLength: 10, maxLength: 10 },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const attendanceSummaryRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tanggal: { type: 'string', minLength: 10, maxLength: 10 },
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
      keterangan: { type: 'string', maxLength: 500 },
    },
  },
} as const;
