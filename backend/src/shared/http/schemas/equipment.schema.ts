const equipmentParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
  },
} as const;

const equipmentFields = {
  kode_alat: { type: 'string', minLength: 1, maxLength: 100 },
  nama_alat: { type: 'string', minLength: 1, maxLength: 200 },
  kategori: { type: 'string', enum: ['Kamera', 'Lensa', 'Audio', 'Lighting', 'Aksesoris', 'Lainnya'] },
  kondisi: { type: 'string', enum: ['bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang'] },
  status: { type: 'string', enum: ['tersedia', 'dipinjam', 'maintenance'] },
  lokasi_penyimpanan: { type: 'string', maxLength: 200 },
  serial_number: { type: 'string', maxLength: 120 },
  foto_urls: {
    type: 'array',
    minItems: 3,
    maxItems: 12,
    items: { type: 'string', minLength: 1, maxLength: 1_500_000 },
  },
  foto_url: { type: 'string', maxLength: 2048 },
  deskripsi: { type: 'string', maxLength: 2000 },
  catatan_kerusakan: { type: 'string', maxLength: 2000 },
  change_reason: { type: 'string', minLength: 5, maxLength: 500 },
};

export const equipmentListRouteSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      kategori: { type: 'string', maxLength: 32 },
      kondisi: { type: 'string', maxLength: 32 },
      status: { type: 'string', maxLength: 32 },
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
    required: ['kode_alat', 'nama_alat', 'foto_urls'],
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
    required: ['kondisi'],
    properties: {
      kondisi: equipmentFields.kondisi,
      status: equipmentFields.status,
      catatan_kerusakan: equipmentFields.catatan_kerusakan,
      change_reason: equipmentFields.change_reason,
    },
  },
} as const;
