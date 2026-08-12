import { parseEquipmentPagination, validateEquipmentPhotos, validatePhotoUrl } from './equipment.helpers.js';
import type {
  EquipmentConditionInput,
  EquipmentCreateInput,
  EquipmentDatabaseError,
  EquipmentListQuery,
  EquipmentRepository,
  EquipmentSummary,
  EquipmentUpdateInput,
} from './equipment.types.js';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS, EQUIPMENT_STATUSES } from './equipment.types.js';

export class EquipmentServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'EquipmentServiceError';
  }
}

type EquipmentBody = Record<string, unknown>;

function requiredText(body: EquipmentBody, field: string, maxLength: number): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new EquipmentServiceError(422, 'INVALID_INPUT', `${field} wajib diisi dan maksimal ${maxLength} karakter.`);
  }
  return value.trim();
}

function optionalText(body: EquipmentBody, field: string, maxLength: number): string | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  if (typeof body[field] !== 'string' || body[field].trim().length > maxLength) {
    throw new EquipmentServiceError(422, 'INVALID_INPUT', `${field} maksimal ${maxLength} karakter.`);
  }
  return body[field].trim();
}

function enumValue<T extends string>(body: EquipmentBody, field: string, values: readonly T[]): T {
  const value = requiredText(body, field, 64);
  if (!(values as readonly string[]).includes(value)) {
    throw new EquipmentServiceError(422, 'INVALID_INPUT', `${field} tidak valid.`);
  }
  return value as T;
}

function mapRepositoryError(error: EquipmentDatabaseError | null, fallbackStatus: number, fallbackMessage: string): EquipmentServiceError {
  const code = error?.code;
  if (code === 'NOT_FOUND') return new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
  if (code === '23505') return new EquipmentServiceError(409, 'EQUIPMENT_CONFLICT', 'Kode alat sudah digunakan.');
  if (code === '23503') return new EquipmentServiceError(409, 'EQUIPMENT_IN_USE', 'Alat masih terikat dengan data peminjaman.');
  if (['42P01', '42703', 'PGRST205'].includes(code || '')) {
    return new EquipmentServiceError(503, 'EQUIPMENT_SCHEMA_UNAVAILABLE', 'Skema peralatan belum tersedia. Jalankan migration peralatan terlebih dahulu.');
  }
  return new EquipmentServiceError(fallbackStatus, 'EQUIPMENT_OPERATION_FAILED', fallbackMessage);
}

export class EquipmentService {
  constructor(private readonly repository: EquipmentRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async list(query: Partial<EquipmentListQuery>) {
    const pageValue = typeof query.page === 'number' ? query.page : Number(query.page || 1);
    const pageSizeValue = typeof query.pageSize === 'number' ? query.pageSize : Number(query.pageSize || 20);
    const pagination = parseEquipmentPagination(pageValue, pageSizeValue);
    const result = await this.repository.list({
      search: typeof query.search === 'string' ? query.search : undefined,
      kategori: typeof query.kategori === 'string' ? query.kategori : undefined,
      kondisi: typeof query.kondisi === 'string' ? query.kondisi : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    if (result.error) throw mapRepositoryError(result.error, 500, 'Gagal memuat daftar peralatan.');
    return {
      data: result.data,
      total: result.count,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(result.count / pagination.pageSize) || 1,
    };
  }

  async summary(): Promise<EquipmentSummary> {
    const result = await this.repository.summary();
    if (result.error || !result.data) throw mapRepositoryError(result.error, 500, 'Gagal memuat ringkasan peralatan.');
    return result.data;
  }

  async findById(id: string) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) {
      throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    }
    const result = await this.repository.findById(normalizedId);
    if (result.error) throw mapRepositoryError(result.error, 500, 'Gagal memuat detail peralatan.');
    if (!result.data) throw new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
    return result.data;
  }

  async create(body: EquipmentBody, actorId: string) {
    const photos = validateEquipmentPhotos(body.foto_urls);
    if (!photos.photos) throw new EquipmentServiceError(422, 'INVALID_PHOTOS', photos.message || 'Foto alat tidak valid.');
    const fotoUrl = optionalText(body, 'foto_url', 2048);
    if (fotoUrl && !validatePhotoUrl(fotoUrl)) throw new EquipmentServiceError(422, 'INVALID_PHOTO_URL', 'foto_url tidak valid.');
    const input: EquipmentCreateInput = {
      kodeAlat: requiredText(body, 'kode_alat', 100),
      namaAlat: requiredText(body, 'nama_alat', 200),
      kategori: body.kategori === undefined ? 'Kamera' : enumValue(body, 'kategori', EQUIPMENT_CATEGORIES),
      kondisi: body.kondisi === undefined ? 'bagus' : enumValue(body, 'kondisi', EQUIPMENT_CONDITIONS),
      status: body.status === undefined ? 'tersedia' : enumValue(body, 'status', EQUIPMENT_STATUSES),
      lokasiPenyimpanan: optionalText(body, 'lokasi_penyimpanan', 200),
      serialNumber: optionalText(body, 'serial_number', 120),
      fotoUrls: photos.photos,
      fotoUrl,
      deskripsi: optionalText(body, 'deskripsi', 2000),
      actorId,
    };
    const result = await this.repository.create(input);
    if (result.error || !result.data) throw mapRepositoryError(result.error, 400, 'Gagal menyimpan data peralatan.');
    return result.data;
  }

  async update(id: string, body: EquipmentBody, actorId: string) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const changes: EquipmentUpdateInput['changes'] = {};
    const textFields = ['kode_alat', 'nama_alat', 'lokasi_penyimpanan', 'serial_number', 'deskripsi'] as const;
    const maxLengths: Record<typeof textFields[number], number> = {
      kode_alat: 100, nama_alat: 200, lokasi_penyimpanan: 200, serial_number: 120, deskripsi: 2000,
    };
    for (const field of textFields) {
      if (body[field] !== undefined) changes[field] = optionalText(body, field, maxLengths[field]);
    }
    if (body.kategori !== undefined) changes.kategori = enumValue(body, 'kategori', EQUIPMENT_CATEGORIES);
    if (body.kondisi !== undefined) changes.kondisi = enumValue(body, 'kondisi', EQUIPMENT_CONDITIONS);
    if (body.status !== undefined) changes.status = enumValue(body, 'status', EQUIPMENT_STATUSES);
    if (body.foto_urls !== undefined) {
      const photos = validateEquipmentPhotos(body.foto_urls);
      if (!photos.photos) throw new EquipmentServiceError(422, 'INVALID_PHOTOS', photos.message || 'Foto alat tidak valid.');
      changes.foto_urls = photos.photos;
    }
    if (body.foto_url !== undefined) {
      const fotoUrl = optionalText(body, 'foto_url', 2048);
      if (fotoUrl && !validatePhotoUrl(fotoUrl)) throw new EquipmentServiceError(422, 'INVALID_PHOTO_URL', 'foto_url tidak valid.');
      changes.foto_url = fotoUrl;
    }
    if (Object.keys(changes).length === 0) throw new EquipmentServiceError(422, 'EMPTY_UPDATE', 'Minimal satu perubahan harus dikirim.');
    const result = await this.repository.update({ id: normalizedId, changes, actorId });
    if (result.error || !result.data) throw mapRepositoryError(result.error, 400, 'Gagal memperbarui data peralatan.');
    return result.data;
  }

  async updateCondition(id: string, body: EquipmentBody, actorId: string) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const input: EquipmentConditionInput = {
      id: normalizedId,
      kondisi: enumValue(body, 'kondisi', EQUIPMENT_CONDITIONS),
      status: body.status === undefined ? undefined : enumValue(body, 'status', EQUIPMENT_STATUSES),
      catatanKerusakan: optionalText(body, 'catatan_kerusakan', 2000),
      actorId,
    };
    const result = await this.repository.updateCondition(input);
    if (result.error || !result.data) throw mapRepositoryError(result.error, 400, 'Gagal memperbarui kondisi peralatan.');
    return result.data;
  }

  async remove(id: string) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const result = await this.repository.remove(normalizedId);
    if (result.error) throw mapRepositoryError(result.error, 400, 'Gagal menghapus data peralatan.');
    if (!result.deletedId) throw new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
    return result.deletedId;
  }
}
