const agendaParams = {
  type: 'object', additionalProperties: false, required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

const agendaFields = {
  activity_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  activity_name: { type: 'string', minLength: 2, maxLength: 120 },
  activity_description: { type: 'string', minLength: 2, maxLength: 2000 },
  instructor_name: { type: 'string', minLength: 2, maxLength: 120 },
  pic_names: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', minLength: 2, maxLength: 100 } },
  expected_version: { type: 'integer', minimum: 1 },
  change_reason: { type: 'string', minLength: 5, maxLength: 500 },
  idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
};

export const agendaListRouteSchema = {
  querystring: {
    type: 'object', additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 }, date_from: agendaFields.activity_date, date_to: agendaFields.activity_date,
      page: { type: 'string', pattern: '^[0-9]+$' }, pageSize: { type: 'string', pattern: '^[0-9]+$' }, include_archived: { type: 'string', enum: ['true', 'false'] },
    },
  },
} as const;

export const agendaDetailRouteSchema = { params: agendaParams } as const;
export const agendaCreateRouteSchema = { body: { type: 'object', additionalProperties: false, required: ['activity_date', 'activity_name', 'activity_description', 'instructor_name', 'pic_names'], properties: agendaFields } } as const;
export const agendaUpdateRouteSchema = { params: agendaParams, body: { type: 'object', additionalProperties: false, required: ['activity_date', 'activity_name', 'activity_description', 'instructor_name', 'pic_names', 'expected_version', 'change_reason'], properties: agendaFields } } as const;
export const agendaArchiveRouteSchema = { params: agendaParams, body: { type: 'object', additionalProperties: false, required: ['change_reason'], properties: { change_reason: agendaFields.change_reason, idempotency_key: agendaFields.idempotency_key } } } as const;
export const agendaPhotoReserveRouteSchema = { params: agendaParams, body: { type: 'object', additionalProperties: false, required: ['file_name', 'content_type', 'file_size_bytes'], properties: { file_name: { type: 'string', minLength: 1, maxLength: 255 }, content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] }, file_size_bytes: { type: 'integer', minimum: 1, maximum: 614400 }, idempotency_key: agendaFields.idempotency_key } } } as const;
export const agendaPhotoCompleteRouteSchema = { params: { type: 'object', additionalProperties: false, required: ['id', 'photoId'], properties: { id: agendaParams.properties.id, photoId: { type: 'string', minLength: 1, maxLength: 64 } } }, body: { type: 'object', additionalProperties: false } } as const;
export const agendaPhotoAccessRouteSchema = agendaDetailRouteSchema;
