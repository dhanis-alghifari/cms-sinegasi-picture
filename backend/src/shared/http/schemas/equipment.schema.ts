const equipmentParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
  },
} as const;

const equipmentFields = {
  equipment_code: { type: 'string', minLength: 1, maxLength: 100 },
  name: { type: 'string', minLength: 1, maxLength: 200 },
  category: { type: 'string', enum: ['camera', 'lens', 'audio', 'lighting', 'accessory', 'other'] },
  condition: { type: 'string', enum: ['good', 'minor_damage', 'damaged', 'severely_damaged', 'under_repair', 'lost'] },
  status: { type: 'string', enum: ['available', 'borrowed', 'maintenance'] },
  storage_location: { type: 'string', maxLength: 200 },
  serial_number: { type: 'string', maxLength: 120 },
  photo_urls: {
    type: 'array',
    minItems: 3,
    maxItems: 12,
    items: { type: 'string', minLength: 1, maxLength: 1_500_000 },
  },
  photo_url: { type: 'string', maxLength: 2048 },
  description: { type: 'string', maxLength: 2000 },
  damage_notes: { type: 'string', maxLength: 2000 },
  change_reason: { type: 'string', minLength: 5, maxLength: 500 },
};

export const equipmentListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      category: { type: 'string', maxLength: 32 },
      condition: { type: 'string', maxLength: 32 },
      status: { type: 'string', maxLength: 32 },
      purpose: { type: 'string', enum: ['borrowing_request'] },
      page: { type: 'string', pattern: '^[0-9]+$' },
      pageSize: { type: 'string', pattern: '^[0-9]+$' },
    },
  },
} as const;

export const equipmentIdRouteSchema = { params: equipmentParams } as const;

export const equipmentCreateRouteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['equipment_code', 'name', 'photo_urls'],
    properties: equipmentFields,
  },
} as const;

export const equipmentUpdateRouteSchema = {
  params: equipmentParams,
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: equipmentFields,
  },
} as const;

export const equipmentConditionRouteSchema = {
  params: equipmentParams,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['condition'],
    properties: {
      condition: equipmentFields.condition,
      status: equipmentFields.status,
      damage_notes: equipmentFields.damage_notes,
      change_reason: equipmentFields.change_reason,
    },
  },
} as const;

export const equipmentReportRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      category: { type: 'string', enum: ['camera', 'lens', 'audio', 'lighting', 'accessory', 'other'] },
      condition: { type: 'string', enum: ['good', 'minor_damage', 'damaged', 'severely_damaged', 'under_repair', 'lost'] },
      status: { type: 'string', enum: ['available', 'borrowed', 'maintenance'] },
      scope: { type: 'string', enum: ['all', 'filtered', 'attention'], default: 'filtered' },
      include_valuation: { type: 'string', enum: ['true', 'false'], default: 'false' },
      include_photos: { type: 'string', enum: ['true', 'false'], default: 'false' },
    },
  },
} as const;

export const equipmentValuationCreateRouteSchema = {
  params: equipmentParams,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['replacement_value'],
    properties: {
      replacement_value: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 },
      currency: { type: 'string', pattern: '^[A-Z]{3}$' },
      effective_at: { type: 'string', minLength: 10, maxLength: 40 },
      source_url: { type: 'string', maxLength: 2048 },
      notes: { type: 'string', maxLength: 2000 },
    },
  },
} as const;

const recoveryCaseParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const recoveryCaseIdParams = {
  type: 'object',
  additionalProperties: false,
  required: ['caseId'],
  properties: { caseId: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

export const equipmentRecoveryListRouteSchema = {
  querystring: {
    type: 'object', additionalProperties: false,
    properties: {
      equipment_id: { type: 'string', maxLength: 128 },
      status: { type: 'string', enum: ['active', 'history', 'open', 'in_progress', 'awaiting_verification', 'completed', 'unrepairable', 'cancelled'] },
    },
  },
} as const;

export const equipmentRecoveryCreateRouteSchema = {
  params: recoveryCaseParams,
  body: {
    type: 'object', additionalProperties: false, required: ['recovery_type', 'reported_condition', 'change_reason'],
    properties: {
      recovery_type: { type: 'string', enum: ['repair', 'replacement'] },
      reported_condition: { type: 'string', enum: ['minor_damage', 'damaged', 'severely_damaged', 'under_repair', 'lost'] },
      assessment_item_id: { type: 'string', maxLength: 128 }, notes: { type: 'string', maxLength: 2000 }, change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const equipmentRecoveryRepairRouteSchema = {
  params: recoveryCaseIdParams,
  body: {
    type: 'object', additionalProperties: false, required: ['inspection_photos', 'inspection_passed', 'change_reason'],
    properties: {
      inspection_photos: { type: 'array', minItems: 2, maxItems: 12, items: { type: 'string', maxLength: 1_500_000 } },
      inspection_passed: { type: 'boolean' },
      actual_cost: { type: 'number', minimum: 0 }, notes: { type: 'string', maxLength: 2000 }, change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const equipmentRecoveryReplacementRouteSchema = {
  params: recoveryCaseIdParams,
  body: {
    type: 'object', additionalProperties: false, required: ['equipment_code', 'name', 'category', 'photo_urls', 'change_reason'],
    properties: {
      equipment_code: { type: 'string', minLength: 2, maxLength: 100 }, name: { type: 'string', minLength: 2, maxLength: 200 },
      category: { type: 'string', enum: ['camera', 'lens', 'audio', 'lighting', 'accessory', 'other'] }, storage_location: { type: 'string', maxLength: 200 },
      serial_number: { type: 'string', maxLength: 120 }, photo_urls: { type: 'array', minItems: 3, maxItems: 12, items: { type: 'string', maxLength: 1_500_000 } },
      description: { type: 'string', maxLength: 2000 }, replacement_value: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 }, change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const equipmentChargeListRouteSchema = {
  querystring: {
    type: 'object', additionalProperties: false,
    properties: { student_id: { type: 'string', maxLength: 128 }, status: { type: 'string', enum: ['unpaid', 'partial', 'paid', 'waived'] } },
  },
} as const;

export const equipmentChargePaymentRouteSchema = {
  params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', maxLength: 128 } } },
  body: {
    type: 'object', additionalProperties: false, required: ['paid_amount', 'status', 'change_reason'],
    properties: { paid_amount: { type: 'number', minimum: 0 }, status: { type: 'string', enum: ['unpaid', 'partial', 'paid', 'waived'] }, notes: { type: 'string', maxLength: 2000 }, change_reason: { type: 'string', minLength: 5, maxLength: 500 } },
  },
} as const;

export const equipmentChargeEvidenceUploadRouteSchema = {
  params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', maxLength: 128 } } },
  body: {
    type: 'object', additionalProperties: false, required: ['evidence_type', 'file_name', 'content_type', 'file_size_bytes'],
    properties: {
      evidence_type: { type: 'string', enum: ['payment', 'repair', 'replacement'] },
      file_name: { type: 'string', minLength: 1, maxLength: 255 },
      content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
      file_size_bytes: { type: 'integer', minimum: 1, maximum: 614400 },
    },
  },
} as const;

export const equipmentChargePaymentEventRouteSchema = {
  params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', maxLength: 128 } } },
  body: {
    type: 'object', additionalProperties: false, required: ['payment_amount', 'evidence_ids', 'change_reason'],
    properties: {
      payment_amount: { type: 'number', exclusiveMinimum: 0, maximum: 9999999999.99 },
      evidence_ids: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 64 } },
      notes: { type: 'string', maxLength: 2000 },
      change_reason: { type: 'string', minLength: 5, maxLength: 500 },
    },
  },
} as const;

export const equipmentEvidenceAccessRouteSchema = {
  params: { type: 'object', additionalProperties: false, required: ['evidenceId'], properties: { evidenceId: { type: 'string', maxLength: 128 } } },
} as const;

export const equipmentChargeEvidenceListRouteSchema = {
  params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', maxLength: 128 } } },
} as const;
