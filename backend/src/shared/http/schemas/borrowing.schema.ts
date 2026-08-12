export const borrowingListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['menunggu_persetujuan', 'disetujui', 'ditolak', 'dipinjam', 'dikembalikan', 'terlambat'] },
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
      tanggal_pinjam: { type: 'string', minLength: 10, maxLength: 10 },
      rencana_kembali: { type: 'string', minLength: 10, maxLength: 10 },
      due_at: { type: 'string', minLength: 10, maxLength: 30 },
      keperluan: { type: 'string', maxLength: 500 },
      keterangan: { type: 'string', maxLength: 500 },
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
      catatan: { type: 'string', maxLength: 500 },
      alasan: { type: 'string', maxLength: 500 },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const borrowingHandoverRouteSchema = {
  params: borrowingIdPathParam,
  body: { type: 'object', additionalProperties: false, properties: {} },
} as const;

export const borrowingReturnRouteSchema = {
  params: borrowingIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['item_conditions'],
    properties: {
      tanggal_dikembalikan: { type: 'string', minLength: 10, maxLength: 10 },
      item_conditions: {
        type: 'array', minItems: 1, maxItems: 50,
        items: {
          type: 'object', additionalProperties: false,
          required: ['equipment_id', 'kondisi_kembali'],
          properties: {
            equipment_id: { type: 'string', minLength: 1, maxLength: 128 },
            kondisi_kembali: { type: 'string', enum: ['bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang'] },
            catatan: { type: 'string', maxLength: 500 },
            denda: { type: 'number', minimum: 0, maximum: 9999999999.99 },
          },
        },
      },
      catatan_pengembalian: { type: 'string', maxLength: 500 },
      total_denda: { type: 'number', minimum: 0, maximum: 9999999999.99 },
      change_reason: { type: 'string', maxLength: 500 },
    },
  },
} as const;
