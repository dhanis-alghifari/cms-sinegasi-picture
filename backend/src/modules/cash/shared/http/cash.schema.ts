export const cashSummaryRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
} as const;

export const cashTransactionsRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tipe: { type: 'string', enum: ['masuk', 'keluar'], maxLength: 16 },
      search: { type: 'string', maxLength: 100 },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
      tanggal_mulai: { type: 'string', minLength: 10, maxLength: 10 },
      tanggal_selesai: { type: 'string', minLength: 10, maxLength: 10 },
      metode_pembayaran: { type: 'string', maxLength: 40 },
    },
  },
} as const;

export const cashPaymentMethodListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: { include_inactive: { type: 'string', enum: ['true', 'false'] } },
  },
} as const;

export const cashPaymentMethodCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'label'],
    properties: {
      code: { type: 'string', minLength: 1, maxLength: 40, pattern: '^[a-z0-9]+(?:_[a-z0-9]+)*$' },
      label: { type: 'string', minLength: 1, maxLength: 80 },
      sort_order: { type: 'integer', minimum: 0, maximum: 9999 },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const cashPaymentMethodUpdateRouteSchema = {
  params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } },
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      label: { type: 'string', minLength: 1, maxLength: 80 },
      sort_order: { type: 'integer', minimum: 0, maximum: 9999 },
      is_active: { type: 'boolean' },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const cashInRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      nominal: { type: 'number', minimum: 0, maximum: 9999999999.99 },
      jumlah: { type: 'number', minimum: 0, maximum: 9999999999.99 },
      tanggal: { type: 'string', minLength: 10, maxLength: 10 },
      keterangan: { type: 'string', maxLength: 500 },
      type: { type: 'string', enum: ['iuran_wajib', 'pemasukan'] },
      student_id: { type: 'string', maxLength: 64 },
      foto_bukti_url: { type: 'string', maxLength: 2000 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      metode_pembayaran: { type: ['string', 'null'], maxLength: 40 },
    },
  },
} as const;

export const cashOutRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      nominal: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 },
      jumlah: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 },
      keterangan: { type: 'string', minLength: 1, maxLength: 500 },
      foto_bukti_url: { type: 'string', maxLength: 2000 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      metode_pembayaran: { type: 'string', maxLength: 40 },
    },
  },
} as const;

export const cashReportRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      start_date: { type: 'string', minLength: 10, maxLength: 10 },
      end_date: { type: 'string', minLength: 10, maxLength: 10 },
      metode_pembayaran: { type: 'string', maxLength: 40 },
    },
  },
} as const;

export const cashDebtListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const cashBillingRulesUpdateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      nominal_iuran_wajib: { type: 'number', minimum: 500, maximum: 9999999999.99 },
      holiday_start_date: { type: ['string', 'null'], minLength: 10, maxLength: 10 },
      holiday_end_date: { type: ['string', 'null'], minLength: 10, maxLength: 10 },
      skip_week: { type: 'boolean' },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const cashDisputeCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['transaction_id', 'bukti_sanggahan_url'],
    properties: {
      transaction_id: { type: 'string', minLength: 1, maxLength: 64 },
      student_id: { type: 'string', maxLength: 64 },
      alasan_sanggahan: { type: 'string', maxLength: 2000 },
      reason: { type: 'string', maxLength: 2000 },
      bukti_sanggahan_url: { type: 'string', minLength: 1, maxLength: 2000 },
    },
  },
} as const;

export const cashDisputeUpdateRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['status'],
    properties: { status: { type: 'string', enum: ['approved', 'rejected', 'resolved'] } },
  },
} as const;
