import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_STATUSES,
  type EquipmentCategory,
  type EquipmentCondition,
  type EquipmentDbRow,
  type EquipmentEntry,
  type EquipmentMemoryState,
  type EquipmentStatus,
} from './equipment.types.js';

export const MAX_EQUIPMENT_PHOTO_BYTES = 600 * 1024;
export const MAX_EQUIPMENT_PHOTOS = 12;
export const EQUIPMENT_PAGE_SIZE_MAX = 100;
export const EQUIPMENT_PAGE_MAX = 10_000;
/** Prevent an unbounded export from exhausting the API or browser tab. */
export const EQUIPMENT_REPORT_MAX_ITEMS = 2_000;

export const EQUIPMENT_SELECT = [
  'id',
  'kode_alat',
  'kode_qr',
  'nama_alat',
  'kategori',
  'kondisi',
  'physical_condition',
  'status',
  'availability_status',
  'lokasi_penyimpanan',
  'serial_number',
  'fotos',
  'foto_url',
  'deskripsi',
  'catatan_kerusakan',
  'asset_state',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
].join(',');

export function textValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function mapEquipmentRow(row: EquipmentDbRow, isReserved = false): EquipmentEntry {
  const fotos = Array.isArray(row.fotos)
    ? row.fotos.filter((foto): foto is string => typeof foto === 'string' && foto.trim().length > 0)
    : [];
  const legacyFoto = textValue(row.foto_url).trim();
  let fotoUrls: string[] = [];
  if (fotos.length > 0) fotoUrls = fotos;
  else if (legacyFoto) fotoUrls = [legacyFoto];
  const status = textValue(row.status ?? row.availability_status, 'tersedia');

  return {
    id: textValue(row.id),
    kode_alat: textValue(row.kode_alat ?? row.kode_qr),
    nama_alat: textValue(row.nama_alat),
    kategori: textValue(row.kategori, 'Lainnya'),
    kondisi: textValue(row.kondisi ?? row.physical_condition, 'bagus'),
    status,
    asset_state: textValue(row.asset_state, 'active'),
    lokasi_penyimpanan: textValue(row.lokasi_penyimpanan) || undefined,
    serial_number: textValue(row.serial_number) || undefined,
    foto_urls: fotoUrls,
    foto_url: fotoUrls[0] || undefined,
    reservation_status: isReserved && status === 'tersedia' ? 'dipesan' : 'tersedia',
    deskripsi: textValue(row.deskripsi) || undefined,
    catatan_kerusakan: textValue(row.catatan_kerusakan) || undefined,
    replacement_value: row.replacement_value === null || row.replacement_value === undefined ? undefined : Number(row.replacement_value),
    replacement_value_currency: textValue(row.replacement_value_currency) || undefined,
    replacement_value_effective_at: textValue(row.replacement_value_effective_at) || undefined,
    created_at: textValue(row.created_at),
    created_by: textValue(row.created_by) || undefined,
    updated_at: textValue(row.updated_at) || undefined,
    updated_by: textValue(row.updated_by) || undefined,
  };
}

export function sanitizeEquipmentSearch(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9À-ÿ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

export function parseEquipmentPagination(pageValue?: number, pageSizeValue?: number): { page: number; pageSize: number; from: number; to: number } {
  const rawPage = Number.isFinite(pageValue) ? Math.floor(pageValue as number) : 1;
  const rawPageSize = Number.isFinite(pageSizeValue) ? Math.floor(pageSizeValue as number) : 20;
  const page = Math.min(EQUIPMENT_PAGE_MAX, Math.max(1, rawPage));
  const pageSize = Math.min(EQUIPMENT_PAGE_SIZE_MAX, Math.max(1, rawPageSize));
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function isEquipmentCategory(value: unknown): value is EquipmentCategory {
  return typeof value === 'string' && (EQUIPMENT_CATEGORIES as readonly string[]).includes(value);
}

export function isEquipmentCondition(value: unknown): value is EquipmentCondition {
  return typeof value === 'string' && (EQUIPMENT_CONDITIONS as readonly string[]).includes(value);
}

export function isEquipmentStatus(value: unknown): value is EquipmentStatus {
  return typeof value === 'string' && (EQUIPMENT_STATUSES as readonly string[]).includes(value);
}

export function validatePhotoUrl(value: string): boolean {
  if (value.startsWith('data:')) {
    return /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function validateEquipmentPhotos(value: unknown): { photos?: string[]; message?: string } {
  if (!Array.isArray(value)) {
    return { message: 'Minimal 3 foto kondisi alat dari sudut berbeda wajib diunggah.' };
  }

  const photos = value
    .filter((photo): photo is string => typeof photo === 'string')
    .map((photo) => photo.trim())
    .filter(Boolean);

  if (photos.length < 3) {
    return { message: 'Minimal 3 foto kondisi alat dari sudut berbeda wajib diunggah.' };
  }
  if (photos.length > MAX_EQUIPMENT_PHOTOS) {
    return { message: `Jumlah foto maksimal ${MAX_EQUIPMENT_PHOTOS}.` };
  }

  for (const photo of photos) {
    if (!validatePhotoUrl(photo)) {
      return { message: 'Setiap foto harus berupa URL http(s) atau data:image base64 yang valid.' };
    }
    if (photo.startsWith('data:')) {
      const encodedImage = photo.slice(photo.indexOf(',') + 1);
      const decodedBytes = Buffer.from(encodedImage, 'base64').byteLength;
      if (decodedBytes === 0 || decodedBytes > MAX_EQUIPMENT_PHOTO_BYTES) {
        return { message: 'Ukuran setiap foto maksimal 600 KB.' };
      }
    }
  }

  return { photos };
}

export function equipmentDbPayload(body: {
  kode_alat?: string;
  nama_alat?: string;
  kategori?: string;
  kondisi?: string;
  status?: string;
  lokasi_penyimpanan?: string;
  serial_number?: string;
  foto_urls?: string[];
  foto_url?: string;
  deskripsi?: string;
  catatan_kerusakan?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (body.kode_alat !== undefined) {
    payload.kode_alat = body.kode_alat;
    payload.kode_qr = body.kode_alat;
  }
  if (body.nama_alat !== undefined) payload.nama_alat = body.nama_alat;
  if (body.kategori !== undefined) payload.kategori = body.kategori;
  if (body.kondisi !== undefined) {
    payload.kondisi = body.kondisi;
    payload.physical_condition = body.kondisi;
  }
  if (body.status !== undefined) {
    payload.status = body.status;
    payload.availability_status = body.status;
  }
  if (body.lokasi_penyimpanan !== undefined) payload.lokasi_penyimpanan = body.lokasi_penyimpanan;
  if (body.serial_number !== undefined) payload.serial_number = body.serial_number;
  if (body.foto_urls !== undefined) {
    payload.fotos = body.foto_urls;
    payload.foto_url = body.foto_urls[0] || null;
  } else if (body.foto_url !== undefined) {
    payload.foto_url = body.foto_url || null;
  }
  if (body.deskripsi !== undefined) payload.deskripsi = body.deskripsi;
  if (body.catatan_kerusakan !== undefined) payload.catatan_kerusakan = body.catatan_kerusakan;
  return payload;
}

export function createEquipmentMemoryState(): EquipmentMemoryState {
  return {
    equipment: [
      { id: 'eq-001', kode_alat: 'CAM-001', nama_alat: 'Sony Alpha A7 III', kategori: 'Kamera', kondisi: 'bagus', status: 'tersedia', lokasi_penyimpanan: 'Gudang Rak A-1', serial_number: 'SN-998201', foto_url: '', created_at: '2026-08-01T00:00:00.000Z' },
      { id: 'eq-002', kode_alat: 'LNS-001', nama_alat: 'Sony FE 24-70mm f/2.8 GM', kategori: 'Lensa', kondisi: 'bagus', status: 'dipinjam', lokasi_penyimpanan: 'Gudang Rak A-2', serial_number: 'SN-112034', foto_url: '', created_at: '2026-08-01T00:00:00.000Z' },
      { id: 'eq-003', kode_alat: 'AUD-001', nama_alat: 'Rode Wireless GO II', kategori: 'Audio', kondisi: 'sedikit_kerusakan', status: 'tersedia', lokasi_penyimpanan: 'Gudang Rak B-1', serial_number: 'SN-556102', foto_url: '', created_at: '2026-08-02T00:00:00.000Z' },
    ],
  };
}
