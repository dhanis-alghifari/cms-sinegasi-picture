import { MAX_CASH_PROOF_URL_LENGTH } from '../cash.helpers.js';

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
      type: { type: 'string', enum: ['income', 'expense'], maxLength: 16 },
      search: { type: 'string', maxLength: 100 },
      student_id: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
      start_date: { type: 'string', minLength: 10, maxLength: 10 },
      end_date: { type: 'string', minLength: 10, maxLength: 10 },
      payment_method: { type: 'string', maxLength: 40 },
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
      amount: { type: 'number', minimum: 0, maximum: 9999999999.99 },
      date: { type: 'string', minLength: 10, maxLength: 10 },
      description: { type: 'string', maxLength: 500 },
      type: { type: 'string', enum: ['mandatory_fee', 'other_income'] },
      student_id: { type: 'string', maxLength: 64 },
      proof_photo_url: { type: 'string', maxLength: MAX_CASH_PROOF_URL_LENGTH },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      payment_method: { type: ['string', 'null'], maxLength: 40 },
    },
  },
} as const;

export const cashOutRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      amount: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 },
      description: { type: 'string', minLength: 1, maxLength: 500 },
      proof_photo_url: { type: 'string', maxLength: MAX_CASH_PROOF_URL_LENGTH },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      payment_method: { type: 'string', maxLength: 40 },
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
      payment_method: { type: 'string', maxLength: 40 },
    },
  },
} as const;

export const cashDebtListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      student_id: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      },
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
      mandatory_fee_amount: { type: 'number', minimum: 500, maximum: 9999999999.99 },
      holiday_start_date: { type: ['string', 'null'], minLength: 10, maxLength: 10 },
      holiday_end_date: { type: ['string', 'null'], minLength: 10, maxLength: 10 },
      skip_week: { type: 'boolean' },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const cashDisputeCreateRouteSchema = {
  headers: {
    type: 'object',
    required: ['x-idempotency-key'],
    properties: {
      'x-idempotency-key': { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['reason', 'evidence_url'],
    oneOf: [
      { required: ['transaction_id'], not: { required: ['debt_record_id'] } },
      { required: ['debt_record_id'], not: { required: ['transaction_id'] } },
    ],
    properties: {
      transaction_id: { type: 'string', minLength: 1, maxLength: 64 },
      debt_record_id: { type: 'string', minLength: 1, maxLength: 64 },
      reason: { type: 'string', minLength: 10, maxLength: 2000 },
      evidence_url: { type: 'string', minLength: 1, maxLength: MAX_CASH_PROOF_URL_LENGTH },
    },
  },
} as const;

export const cashDisputeListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
      cursor: { type: 'string', minLength: 1, maxLength: 512 },
      limit: { type: 'string', pattern: '^[0-9]+$' },
      status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
    },
  },
} as const;

export const cashDisputeQuotaRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {} },
} as const;

export const cashDisputeEvidenceRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
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
    required: ['status', 'review_note'],
    properties: {
      status: { type: 'string', enum: ['approved', 'rejected', 'resolved'] },
      review_note: { type: 'string', minLength: 5, maxLength: 2000 },
      resolution_date: { type: 'string', minLength: 10, maxLength: 10 },
      resolution_amount: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 },
      payment_method_code: { type: 'string', minLength: 1, maxLength: 40 },
    },
  },
} as const;
