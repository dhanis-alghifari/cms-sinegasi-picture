import { parseEquipmentPagination, validateEquipmentPhotos, validatePhotoUrl } from './equipment.helpers.js';
import type {
  EquipmentConditionInput,
  EquipmentCreateInput,
  EquipmentDatabaseError,
  EquipmentListQuery,
  EquipmentReport,
  EquipmentReportAvailability,
  EquipmentReportCategory,
  EquipmentReportCondition,
  EquipmentReportItem,
  EquipmentReportQuery,
  EquipmentRepository,
  EquipmentSummary,
  EquipmentUpdateInput,
  EquipmentValuation,
  EquipmentValuationInput,
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

function requiredChangeReason(value: string): string {
  if (typeof value !== 'string' || value.trim().length < 5 || value.trim().length > 500) {
    throw new EquipmentServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan perubahan wajib diisi (5-500 karakter).');
  }
  return value.trim();
}

function enumValue<T extends string>(body: EquipmentBody, field: string, values: readonly T[]): T {
  const value = requiredText(body, field, 64);
  if (!(values as readonly string[]).includes(value)) {
    throw new EquipmentServiceError(422, 'INVALID_INPUT', `${field} tidak valid.`);
  }
  return value as T;
}

function assertEquipmentState(condition: string, status: string): void {
  const valid = condition === 'bagus'
    ? status === 'tersedia' || status === 'dipinjam'
    : status === 'maintenance';
  if (!valid) {
    throw new EquipmentServiceError(422, 'INVALID_EQUIPMENT_STATE', 'Kondisi bagus hanya dapat berstatus tersedia atau dipinjam; kondisi lain harus berstatus maintenance.');
  }
}

function mapRepositoryError(error: EquipmentDatabaseError | null, fallbackStatus: number, fallbackMessage: string): EquipmentServiceError {
  const code = error?.code;
  const message = error?.message || '';
  if (code === 'NOT_FOUND') return new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
  if (message === 'EQUIPMENT_NOT_FOUND') return new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
  if (code === '23505') return new EquipmentServiceError(409, 'EQUIPMENT_CONFLICT', 'Kode alat sudah digunakan.');
  if (code === '23503') return new EquipmentServiceError(409, 'EQUIPMENT_IN_USE', 'Alat masih terikat dengan data peminjaman.');
  if (code === 'REPORT_TOO_LARGE') return new EquipmentServiceError(413, 'EQUIPMENT_REPORT_TOO_LARGE', 'Laporan terlalu besar. Gunakan filter agar jumlah alat maksimal 2.000 unit.');
  if (['EQUIPMENT_UPDATE_ACTOR_FORBIDDEN', 'EQUIPMENT_DELETE_ACTOR_FORBIDDEN'].includes(message)) {
    return new EquipmentServiceError(403, 'EQUIPMENT_OPERATION_FORBIDDEN', 'Akun tidak berwenang mengubah data peralatan.');
  }
  if (message === 'EQUIPMENT_CHANGE_REASON_REQUIRED') {
    return new EquipmentServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan perubahan wajib diisi.');
  }
  if (message === 'EQUIPMENT_STATE_INVALID') {
    return new EquipmentServiceError(422, 'INVALID_EQUIPMENT_STATE', 'Kondisi bagus hanya dapat berstatus tersedia atau dipinjam; kondisi lain harus berstatus maintenance.');
  }
  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST205'].includes(code || '')) {
    return new EquipmentServiceError(503, 'EQUIPMENT_SCHEMA_UNAVAILABLE', 'Skema peralatan belum tersedia. Jalankan migration peralatan terlebih dahulu.');
  }
  return new EquipmentServiceError(fallbackStatus, 'EQUIPMENT_OPERATION_FAILED', fallbackMessage);
}

function resolveReportScope(query: EquipmentReportQuery): NonNullable<EquipmentReportQuery['scope']> {
  if (query.scope) return query.scope;
  if (query.attentionOnly) return 'attention';
  if (query.search || query.kategori || query.kondisi || query.status) return 'filtered';
  return 'all';
}

function resolveAvailabilityStatus(
  condition: string,
  currentStatus?: string,
): 'tersedia' | 'dipinjam' | 'maintenance' {
  if (condition === 'bagus' && currentStatus === 'dipinjam') return 'dipinjam';
  if (condition === 'bagus') return 'tersedia';
  return 'maintenance';
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

  async report(query: EquipmentReportQuery): Promise<EquipmentReport> {
    const scope = resolveReportScope(query);
    const result = await this.repository.report(query);
    if (result.error) throw mapRepositoryError(result.error, 500, 'Gagal memuat laporan peralatan.');

    const includeValuation = query.includeValuation === true;
    const includePhotos = query.includePhotos === true;
    const mappedItems = result.data.map((item) => reportItem(item, includeValuation, includePhotos));
    const items = query.attentionOnly
      ? mappedItems.filter((item) => reportAttentionReasons(item, includeValuation).length > 0)
      : mappedItems;
    const attentionItems = items
      .map((item) => ({ item, reasons: reportAttentionReasons(item, includeValuation) }))
      .filter(({ reasons }) => reasons.length > 0)
      .map(({ item, reasons }) => ({ ...item, attention_reasons: reasons }));
    const damagedConditions = new Set<EquipmentReportCondition>(['minor_damage', 'damaged', 'severely_damaged']);
    const availableUnits = items.filter((item) => item.availability_status === 'available').length;
    const borrowedUnits = items.filter((item) => item.availability_status === 'borrowed').length;
    const maintenanceUnits = items.filter((item) => item.availability_status === 'maintenance').length;
    const reservedUnits = items.filter((item) => item.reservation_status === 'reserved').length;
    const goodConditionUnits = items.filter((item) => item.condition === 'good').length;
    const damagedUnits = items.filter((item) => damagedConditions.has(item.condition)).length;
    const underRepairUnits = items.filter((item) => item.condition === 'under_repair').length;
    const lostUnits = items.filter((item) => item.condition === 'lost' || item.asset_state === 'lost').length;
    const valuationConfiguredUnits = includeValuation ? items.filter((item) => item.replacement_value !== undefined).length : 0;
    const replacementValueTotal = includeValuation
      ? items.reduce((total, item) => total + (item.replacement_value || 0), 0)
      : undefined;

    return {
      meta: {
        report_version: 1,
        generated_at: new Date().toISOString(),
        timezone: 'Asia/Jakarta',
        filters: {
          ...(query.search ? { search: query.search } : {}),
          ...(query.kategori ? { category: reportCategoryCodes[query.kategori] ?? query.kategori } : {}),
          ...(query.kondisi ? { condition: reportConditionCodes[query.kondisi] ?? query.kondisi } : {}),
          ...(query.status ? { status: reportAvailabilityCodes[query.status] ?? query.status } : {}),
          scope,
        },
      },
      summary: {
        total_units: items.length,
        available_units: availableUnits,
        borrowed_units: borrowedUnits,
        maintenance_units: maintenanceUnits,
        reserved_units: reservedUnits,
        good_condition_units: goodConditionUnits,
        damaged_units: damagedUnits,
        under_repair_units: underRepairUnits,
        lost_units: lostUnits,
        attention_units: attentionItems.length,
        valuation_configured_units: valuationConfiguredUnits,
        valuation_missing_units: includeValuation ? items.length - valuationConfiguredUnits : 0,
        ...(replacementValueTotal === undefined ? {} : { replacement_value_total: replacementValueTotal }),
      },
      breakdowns: {
        by_category: countBreakdown(items, 'category'),
        by_condition: countBreakdown(items, 'condition'),
        by_availability: countBreakdown(items, 'availability_status'),
      },
      attention_items: attentionItems,
      items,
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
    assertEquipmentState(input.kondisi, input.status);
    const result = await this.repository.create(input);
    if (result.error || !result.data) throw mapRepositoryError(result.error, 400, 'Gagal menyimpan data peralatan.');
    return result.data;
  }

  async update(id: string, body: EquipmentBody, actorId: string, changeReason: string) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const normalizedChangeReason = requiredChangeReason(changeReason);
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
    if (changes.kondisi !== undefined || changes.status !== undefined) {
      let current: import('./equipment.types.js').EquipmentEntry | null = null;
      if (changes.kondisi === undefined || changes.status === undefined) {
        const currentResult = await this.repository.findById(normalizedId);
        if (currentResult.error) throw mapRepositoryError(currentResult.error, 500, 'Gagal memuat kondisi peralatan saat ini.');
        if (!currentResult.data) throw new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
        current = currentResult.data;
      }
      const nextCondition = changes.kondisi ?? current?.kondisi ?? 'bagus';
      if (changes.status === undefined) {
        changes.status = resolveAvailabilityStatus(nextCondition, current?.status);
      }
      assertEquipmentState(nextCondition, changes.status);
    }
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
    const result = await this.repository.update({ id: normalizedId, changes, actorId, changeReason: normalizedChangeReason });
    if (result.error || !result.data) throw mapRepositoryError(result.error, 500, 'Gagal memperbarui data peralatan.');
    return result.data;
  }

  async updateCondition(id: string, body: EquipmentBody, actorId: string, changeReason: string) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const normalizedChangeReason = requiredChangeReason(changeReason);
    const input: EquipmentConditionInput = {
      id: normalizedId,
      kondisi: enumValue(body, 'kondisi', EQUIPMENT_CONDITIONS),
      status: body.status === undefined ? undefined : enumValue(body, 'status', EQUIPMENT_STATUSES),
      catatanKerusakan: optionalText(body, 'catatan_kerusakan', 2000),
      actorId,
      changeReason: normalizedChangeReason,
    };
    if (input.status === undefined) {
      const currentResult = await this.repository.findById(normalizedId);
      if (currentResult.error) throw mapRepositoryError(currentResult.error, 500, 'Gagal memuat status peralatan saat ini.');
      if (!currentResult.data) throw new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
      input.status = resolveAvailabilityStatus(input.kondisi, currentResult.data.status);
    }
    assertEquipmentState(input.kondisi, input.status);
    const result = await this.repository.updateCondition(input);
    if (result.error || !result.data) throw mapRepositoryError(result.error, 500, 'Gagal memperbarui kondisi peralatan.');
    return result.data;
  }

  async remove(id: string, actorId: string, changeReason: string) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const normalizedChangeReason = requiredChangeReason(changeReason);
    const result = await this.repository.remove({ id: normalizedId, actorId, changeReason: normalizedChangeReason });
    if (result.error) throw mapRepositoryError(result.error, 500, 'Gagal menghapus data peralatan.');
    if (!result.deletedId) throw new EquipmentServiceError(404, 'EQUIPMENT_NOT_FOUND', 'Alat tidak ditemukan.');
    return result.deletedId;
  }

  async listValuations(id: string): Promise<EquipmentValuation[]> {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const result = await this.repository.listValuations(normalizedId);
    if (result.error) throw mapRepositoryError(result.error, 500, 'Gagal memuat histori valuasi alat.');
    return result.data;
  }

  async createValuation(id: string, body: EquipmentBody, actorId: string, changeReason: string): Promise<EquipmentValuation> {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || normalizedId.length > 64) throw new EquipmentServiceError(422, 'INVALID_ID', 'ID alat tidak valid.');
    const normalizedReason = requiredChangeReason(changeReason);
    if (body.replacement_value === undefined || body.replacement_value === null || body.replacement_value === '') {
      throw new EquipmentServiceError(422, 'REPLACEMENT_VALUE_REQUIRED', 'Nilai penggantian wajib diisi.');
    }
    const replacementValue = Number(body.replacement_value);
    if (!Number.isFinite(replacementValue) || replacementValue <= 0 || replacementValue > 9_999_999_999.99) {
      throw new EquipmentServiceError(422, 'INVALID_REPLACEMENT_VALUE', 'Nilai penggantian harus lebih besar dari 0 dan maksimal Rp9.999.999.999,99.');
    }
    const currency = typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency.trim()) ? body.currency.trim() : 'IDR';
    const effectiveAt = body.effective_at === undefined ? undefined : optionalText(body, 'effective_at', 40);
    const sourceUrl = optionalText(body, 'source_url', 2048);
    if (sourceUrl && !validatePhotoUrl(sourceUrl)) throw new EquipmentServiceError(422, 'INVALID_SOURCE_URL', 'source_url tidak valid.');
    const notes = optionalText(body, 'notes', 2000);
    const input: EquipmentValuationInput = { equipmentId: normalizedId, replacementValue, currency, effectiveAt, sourceUrl, notes, actorId, changeReason: normalizedReason };
    const result = await this.repository.createValuation(input);
    if (result.error || !result.data) throw mapRepositoryError(result.error, 400, 'Gagal menyimpan valuasi alat.');
    return result.data;
  }
}

const reportCategoryCodes: Readonly<Record<string, EquipmentReportCategory>> = {
  Kamera: 'camera', Lensa: 'lens', Audio: 'audio', Lighting: 'lighting', Aksesoris: 'accessory', Lainnya: 'other',
};

const reportConditionCodes: Readonly<Record<string, EquipmentReportCondition>> = {
  bagus: 'good', sedikit_kerusakan: 'minor_damage', rusak: 'damaged', rusak_besar: 'severely_damaged', sedang_diperbaiki: 'under_repair', hilang: 'lost',
};

const reportAvailabilityCodes: Readonly<Record<string, EquipmentReportAvailability>> = {
  tersedia: 'available', dipinjam: 'borrowed', maintenance: 'maintenance',
};

function reportItem(item: import('./equipment.types.js').EquipmentEntry, includeValuation: boolean, includePhotos: boolean): EquipmentReportItem {
  const assetState = item.asset_state === 'lost' || item.asset_state === 'retired' ? item.asset_state : 'active';
  return {
    id: item.id,
    equipment_code: item.kode_alat,
    name: item.nama_alat,
    category: reportCategoryCodes[item.kategori] ?? 'other',
    condition: reportConditionCodes[item.kondisi] ?? 'good',
    availability_status: reportAvailabilityCodes[item.status] ?? 'available',
    reservation_status: item.reservation_status === 'dipesan' ? 'reserved' : 'available',
    storage_location: item.lokasi_penyimpanan,
    serial_number: item.serial_number,
    // A report needs one representative image per item; sending the full upload set
    // would make a filtered export unnecessarily large.
    ...(includePhotos && item.foto_urls?.[0] ? { photo_urls: [item.foto_urls[0]] } : {}),
    description: item.deskripsi,
    damage_notes: item.catatan_kerusakan,
    asset_state: assetState,
    ...(includeValuation && item.replacement_value !== undefined ? {
      replacement_value: item.replacement_value,
      replacement_value_currency: item.replacement_value_currency || 'IDR',
      replacement_value_effective_at: item.replacement_value_effective_at,
    } : {}),
    updated_at: item.updated_at || item.created_at,
  };
}

function reportAttentionReasons(item: EquipmentReportItem, includeValuation: boolean): string[] {
  const reasons: string[] = [];
  if (item.condition === 'minor_damage' || item.condition === 'damaged' || item.condition === 'severely_damaged') reasons.push('damaged');
  if (item.condition === 'under_repair' || item.availability_status === 'maintenance') reasons.push('maintenance');
  if (item.condition === 'lost' || item.asset_state === 'lost') reasons.push('lost');
  if (item.asset_state === 'retired') reasons.push('retired');
  if (includeValuation && item.replacement_value === undefined) reasons.push('missing_valuation');
  if (!item.storage_location) reasons.push('missing_storage_location');
  if (!item.serial_number) reasons.push('missing_serial_number');
  return reasons;
}

function countBreakdown(items: EquipmentReportItem[], field: 'category' | 'condition' | 'availability_status'): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item[field], (counts.get(item[field]) || 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([key, count]) => ({ key, count }));
}
