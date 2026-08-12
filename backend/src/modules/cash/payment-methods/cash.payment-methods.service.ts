import { isMissingCashSchemaError, normalizePaymentMethodCode, normalizePaymentMethodLabel, CASH_SCHEMA_MIGRATION_MESSAGE } from '../shared/cash.helpers.js';
import type { CashPaymentMethodInput, CashPaymentMethodUpdate } from '../shared/cash.types.js';
import type { CashPaymentMethodsRepository } from './cash.payment-methods.repository.js';
import type { CashRepositoryError } from '../shared/cash.types.js';

export class CashPaymentMethodsServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'CashPaymentMethodsServiceError';
  }
}

function mapRepositoryError(error: CashRepositoryError, fallback: string): never {
  if (isMissingCashSchemaError(error)) throw new CashPaymentMethodsServiceError(503, 'CASH_SCHEMA_UNAVAILABLE', CASH_SCHEMA_MIGRATION_MESSAGE);
  if (error?.code === '23505') throw new CashPaymentMethodsServiceError(409, 'PAYMENT_METHOD_EXISTS', 'Code metode pembayaran sudah digunakan.');
  throw new CashPaymentMethodsServiceError(400, 'PAYMENT_METHOD_FAILED', fallback);
}

export class CashPaymentMethodsService {
  constructor(private readonly repository: CashPaymentMethodsRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async list(includeInactive: boolean) {
    const result = await this.repository.list(includeInactive);
    if (result.error) mapRepositoryError(result.error, 'Gagal memuat metode pembayaran.');
    return result.data;
  }

  async create(input: CashPaymentMethodInput, actorId: string, changeReason: string) {
    const code = normalizePaymentMethodCode(input.code);
    const label = normalizePaymentMethodLabel(input.label);
    const sortOrder = input.sort_order === undefined ? 0 : Number(input.sort_order);
    this.validateChangeReason(changeReason);
    if (!code || code.length > 40) throw new CashPaymentMethodsServiceError(422, 'INVALID_CODE', 'Code metode hanya boleh berisi huruf kecil, angka, dan underscore (maksimal 40 karakter).');
    if (!label) throw new CashPaymentMethodsServiceError(422, 'INVALID_LABEL', 'Nama metode pembayaran wajib diisi maksimal 80 karakter.');
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) throw new CashPaymentMethodsServiceError(422, 'INVALID_SORT_ORDER', 'Urutan metode pembayaran tidak valid.');
    const result = await this.repository.create({ code, label, sortOrder, actorId });
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal menambahkan metode pembayaran.');
    return result.data;
  }

  async update(id: string, input: CashPaymentMethodUpdate, actorId: string, changeReason: string) {
    this.validateChangeReason(changeReason);
    if (!id) throw new CashPaymentMethodsServiceError(422, 'INVALID_ID', 'ID metode pembayaran wajib diisi.');
    if ('code' in input) throw new CashPaymentMethodsServiceError(422, 'CODE_IMMUTABLE', 'Code metode tidak dapat diubah karena menjadi identitas histori transaksi.');
    const currentResult = await this.repository.findById(id);
    if (currentResult.error) mapRepositoryError(currentResult.error, 'Gagal memeriksa metode pembayaran.');
    const current = currentResult.data;
    if (!current) throw new CashPaymentMethodsServiceError(404, 'NOT_FOUND', 'Metode pembayaran tidak ditemukan.');
    const label = input.label === undefined ? undefined : normalizePaymentMethodLabel(input.label);
    const sortOrder = input.sort_order === undefined ? undefined : Number(input.sort_order);
    if (input.label !== undefined && !label) throw new CashPaymentMethodsServiceError(422, 'INVALID_LABEL', 'Nama metode pembayaran wajib diisi maksimal 80 karakter.');
    if (input.sort_order !== undefined && (!Number.isInteger(sortOrder) || sortOrder! < 0 || sortOrder! > 9999)) throw new CashPaymentMethodsServiceError(422, 'INVALID_SORT_ORDER', 'Urutan metode pembayaran tidak valid.');
    if (input.is_active !== undefined && typeof input.is_active !== 'boolean') throw new CashPaymentMethodsServiceError(422, 'INVALID_STATUS', 'Status aktif metode pembayaran tidak valid.');
    if (input.is_active === false && current.code === 'cash' && current.is_active) throw new CashPaymentMethodsServiceError(422, 'DEFAULT_METHOD_REQUIRED', 'Metode Cash adalah fallback histori dan tidak dapat dinonaktifkan.');
    if (input.is_active === false && current.is_active) {
      const active = await this.repository.countActive();
      if (active.error) mapRepositoryError(active.error, 'Gagal memeriksa metode aktif.');
      if (active.count <= 1) throw new CashPaymentMethodsServiceError(422, 'DEFAULT_METHOD_REQUIRED', 'Minimal satu metode pembayaran harus tetap aktif.');
    }
    const result = await this.repository.update(id, { label: label || undefined, sortOrder, isActive: input.is_active as boolean | undefined, actorId });
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal memperbarui metode pembayaran.');
    return { previous: current, current: result.data };
  }

  private validateChangeReason(changeReason: string) {
    if (changeReason.trim().length < 5) throw new CashPaymentMethodsServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan perubahan minimal 5 karakter.');
  }
}
