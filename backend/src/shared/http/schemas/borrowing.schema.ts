export const borrowingListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['pending_approval', 'approved', 'rejected', 'borrowed', 'pending_verification', 'returned', 'overdue'] },
      borrower_id: { type: 'string', maxLength: 64 },
      search: { type: 'string', maxLength: 100 },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const borrowingSummaryRouteSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {} },
} as const;

const borrowingIdParam = {
  type: 'object',
  additionalProperties: false,
  required: ['borrowing_id'],
  properties: { borrowing_id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const borrowingIdPathParam = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

export const borrowingCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      student_id: { type: 'string', minLength: 1, maxLength: 128 },
      borrower_id: { type: 'string', minLength: 1, maxLength: 128 },
      equipment_ids: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 128 } },
      borrow_date: { type: 'string', minLength: 10, maxLength: 10 },
      planned_return_date: { type: 'string', minLength: 10, maxLength: 10 },
      due_at: { type: 'string', minLength: 10, maxLength: 30 },
      purpose: { type: 'string', maxLength: 500 },
      notes: { type: 'string', maxLength: 500 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
} as const;

export const borrowingApproveRejectRouteSchema = {
  params: borrowingIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: { type: 'string', enum: ['approve', 'reject'] },
      borrowing_id: { type: 'string', minLength: 1, maxLength: 128 },
      notes: { type: 'string', maxLength: 500 },
      reason: { type: 'string', maxLength: 500 },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const borrowingHandoverRouteSchema = {
  params: borrowingIdPathParam,
  body: { type: 'object', additionalProperties: false, properties: {} },
} as const;

const returnConditionValues = ['good', 'minor_damage', 'damaged', 'severely_damaged', 'lost'] as const;
const returnItemProperties = {
  equipment_id: { type: 'string', minLength: 1, maxLength: 128 },
  condition: { type: 'string', enum: returnConditionValues },
  notes: { type: 'string', maxLength: 500 },
  settlement_method: { type: 'string', enum: ['none', 'repair', 'replacement'] },
  repair_cost: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 },
  evidence_ids: {
    type: 'array', maxItems: 5, uniqueItems: true,
    items: { type: 'string', minLength: 36, maxLength: 36 },
  },
} as const;

const returnItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['equipment_id', 'condition'],
  properties: returnItemProperties,
} as const;

export const borrowingReturnRouteSchema = {
  params: borrowingIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['item_conditions'],
    properties: {
      return_date: { type: 'string', minLength: 10, maxLength: 10 },
      item_conditions: {
        type: 'array', minItems: 1, maxItems: 50,
        items: {
          ...returnItemSchema,
          allOf: [
            {
              if: { properties: { condition: { enum: ['good', 'minor_damage', 'damaged', 'severely_damaged'] } }, required: ['condition'] },
              then: { required: ['evidence_ids'], properties: { evidence_ids: { type: 'array', minItems: 2 } } },
            },
          ],
        },
      },
      return_notes: { type: 'string', maxLength: 500 },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

const returnAssessmentItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['equipment_id', 'condition'],
  properties: {
    equipment_id: returnItemProperties.equipment_id,
    condition: returnItemProperties.condition,
    notes: returnItemProperties.notes,
    settlement_method: returnItemProperties.settlement_method,
    repair_cost: returnItemProperties.repair_cost,
  },
} as const;

export const borrowingReturnAssessmentRouteSchema = {
  params: borrowingIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['item_conditions'],
    properties: {
      return_date: { type: 'string', minLength: 10, maxLength: 10 },
      item_conditions: { type: 'array', minItems: 1, maxItems: 50, items: returnAssessmentItemSchema },
    },
  },
} as const;

export const borrowingReturnEvidenceUploadRouteSchema = {
  params: borrowingIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['equipment_id', 'file_name', 'content_type', 'file_size_bytes'],
    properties: {
      equipment_id: { type: 'string', minLength: 1, maxLength: 128 },
      file_name: { type: 'string', minLength: 1, maxLength: 255 },
      content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
      file_size_bytes: { type: 'integer', minimum: 1, maximum: 614400 },
    },
  },
} as const;

export const borrowingReturnEvidenceListRouteSchema = {
  params: borrowingIdParam,
} as const;

export const borrowingReturnEvidenceAccessRouteSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['evidence_id'],
    properties: { evidence_id: { type: 'string', minLength: 36, maxLength: 36 } },
  },
} as const;

export const borrowingReturnReportEvidenceUploadRouteSchema = borrowingReturnEvidenceUploadRouteSchema;

export const borrowingReturnReportSchema = {
  params: borrowingIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['report_id', 'evidence_ids'],
    properties: {
      report_id: { type: 'string', minLength: 36, maxLength: 36 },
      evidence_ids: { type: 'array', minItems: 2, maxItems: 50, uniqueItems: true, items: { type: 'string', minLength: 36, maxLength: 36 } },
      notes: { type: 'string', maxLength: 1000 },
      return_notes: { type: 'string', maxLength: 1000 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const borrowingReturnVerificationSchema = {
  params: borrowingIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['report_id', 'decision'],
    properties: {
      report_id: { type: 'string', minLength: 36, maxLength: 36 },
      decision: { type: 'string', enum: ['approve', 'reject'] },
      verification_method: { type: 'string', enum: ['photo', 'physical_check', 'photo_and_physical'] },
      rejection_reason: { type: 'string', maxLength: 500 },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 128 },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
      item_conditions: {
        type: 'array', maxItems: 50,
        items: {
          ...returnItemSchema,
          required: ['equipment_id', 'condition'],
        },
      },
    },
  },
} as const;

export const borrowingReturnReportListRouteSchema = { params: borrowingIdParam } as const;
