import {
  CASH_SCHEMA_MIGRATION_MESSAGE,
  getBusinessTodayDate,
  isIsoDate,
  isMissingCashSchemaError,
  normalizePaymentMethodCode,
} from '../shared/cash.helpers.js';
import type { CashReportingRepository } from './cash.reporting.repository.js';
import type {
  BillingRulesUpdate,
  CashDebtQuery,
  CashReportQuery,
  CashReportRange,
  CashReportScope,
} from './cash.reporting.types.js';
import type { CashRepositoryError } from '../shared/cash.types.js';

export class CashReportingServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'CashReportingServiceError';
  }
}

function mapRepositoryError(error: CashRepositoryError, fallback: string): never {
  if (isMissingCashSchemaError(error)) throw new CashReportingServiceError(503, 'CASH_SCHEMA_UNAVAILABLE', CASH_SCHEMA_MIGRATION_MESSAGE);
  throw new CashReportingServiceError(500, 'CASH_REPORTING_FAILED', fallback);
}

export function resolveCashReportRange(startValue?: unknown, endValue?: unknown): CashReportRange | null {
  if (startValue !== undefined && !isIsoDate(startValue)) return null;
  if (endValue !== undefined && !isIsoDate(endValue)) return null;
  const endDate = isIsoDate(endValue) ? endValue : getBusinessTodayDate();
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const defaultStart = new Date(end.getTime());
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
  const startDate = isIsoDate(startValue) ? startValue : defaultStart.toISOString().slice(0, 10);
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (endDate < startDate || days < 1 || days > 90) return null;
  return { startDate, endDate, days };
}

export class CashReportingService {
  constructor(private readonly repository: CashReportingRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async getReport(query: CashReportQuery) {
    const range = resolveCashReportRange(query.start_date, query.end_date);
    if (!range) throw new CashReportingServiceError(422, 'INVALID_REPORT_RANGE', 'Rentang laporan tidak valid. Gunakan tanggal YYYY-MM-DD maksimal 90 hari.');
    const paymentMethodCode = query.metode_pembayaran === undefined ? null : normalizePaymentMethodCode(query.metode_pembayaran);
    if (query.metode_pembayaran !== undefined && !paymentMethodCode) throw new CashReportingServiceError(422, 'INVALID_PAYMENT_METHOD', 'Metode pembayaran tidak valid.');
    const result = await this.repository.getReport(range, paymentMethodCode);
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal memuat laporan kas.');
    return result.data;
  }

  async listDebts(query: CashDebtQuery, scope: CashReportScope) {
    const result = await this.repository.listDebts(query, scope);
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal memuat tunggakan kas.');
    return result.data;
  }

  async getBillingRules() {
    const result = await this.repository.getBillingRules();
    if (result.error) mapRepositoryError(result.error, 'Gagal memuat pengaturan iuran.');
    return result.data;
  }

  async updateBillingRules(input: Record<string, unknown>, actorId: string, changeReason: string) {
    if (changeReason.trim().length < 5) throw new CashReportingServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan perubahan pengaturan minimal 5 karakter.');
    const amount = input.nominal_iuran_wajib === undefined ? undefined : Number(input.nominal_iuran_wajib);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 500 || amount > 9_999_999_999.99)) {
      throw new CashReportingServiceError(422, 'INVALID_AMOUNT', 'Nominal iuran wajib minimal Rp 500 dan tidak melebihi batas sistem.');
    }
    const start = input.holiday_start_date === null || input.holiday_start_date === undefined ? null : String(input.holiday_start_date);
    const end = input.holiday_end_date === null || input.holiday_end_date === undefined ? null : String(input.holiday_end_date);
    if (start && !isIsoDate(start) || end && !isIsoDate(end)) throw new CashReportingServiceError(422, 'INVALID_HOLIDAY_RANGE', 'Tanggal libur harus berupa tanggal kalender yang valid (YYYY-MM-DD).');
    if (start && end && start > end) throw new CashReportingServiceError(422, 'INVALID_HOLIDAY_RANGE', 'Rentang libur semester tidak valid.');
    if (input.skip_week !== undefined && typeof input.skip_week !== 'boolean') throw new CashReportingServiceError(422, 'INVALID_SKIP_WEEK', 'Pengaturan skip_week tidak valid.');
    const update: BillingRulesUpdate = {
      ...(amount === undefined ? {} : { nominal_iuran_wajib: amount }),
      ...(input.holiday_start_date === undefined ? {} : { holiday_start_date: start }),
      ...(input.holiday_end_date === undefined ? {} : { holiday_end_date: end }),
      ...(input.skip_week === undefined ? {} : { skip_week: input.skip_week as boolean }),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    };
    const result = await this.repository.updateBillingRules(update);
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal menyimpan pengaturan iuran.');
    return result.data;
  }
}
