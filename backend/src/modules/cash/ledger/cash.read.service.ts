import { CASH_SCHEMA_MIGRATION_MESSAGE, isIsoDate, isMissingCashSchemaError, isUuid, mapCashTransaction, normalizePaymentMethodCode } from '../shared/cash.helpers.js';
import type { CashReadRepository } from './cash.read.repository.js';
import type { CashReadScope, CashTransactionQuery } from '../shared/cash.types.js';

export class CashReadServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'CashReadServiceError';
  }
}

export class CashReadService {
  constructor(private readonly repository: CashReadRepository) {}

  async getSummary(scope: CashReadScope): Promise<Record<string, unknown>> {
    const result = await this.repository.getSummary(scope);
    if (result.error || !result.data) {
      const missing = isMissingCashSchemaError(result.error);
      throw new CashReadServiceError(500, missing ? 'CASH_SCHEMA_UNAVAILABLE' : 'SUMMARY_FAILED', missing ? CASH_SCHEMA_MIGRATION_MESSAGE : 'Gagal memuat ringkasan kas.');
    }
    return result.data;
  }

  async listTransactions(query: CashTransactionQuery, scope: CashReadScope) {
    if (query.metode_pembayaran && !normalizePaymentMethodCode(query.metode_pembayaran)) {
      throw new CashReadServiceError(422, 'INVALID_PAYMENT_METHOD', 'Metode pembayaran tidak valid.');
    }
    if (query.tanggal_mulai && !isIsoDate(query.tanggal_mulai)) {
      throw new CashReadServiceError(422, 'INVALID_START_DATE', 'Tanggal mulai transaksi tidak valid.');
    }
    if (query.tanggal_selesai && !isIsoDate(query.tanggal_selesai)) {
      throw new CashReadServiceError(422, 'INVALID_END_DATE', 'Tanggal selesai transaksi tidak valid.');
    }
    if (query.student_id && !isUuid(query.student_id)) {
      throw new CashReadServiceError(422, 'INVALID_STUDENT_ID', 'ID siswa tidak valid.');
    }
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20));
    const result = await this.repository.listTransactions(query, scope);
    if (result.error) {
      const missing = isMissingCashSchemaError(result.error);
      throw new CashReadServiceError(missing ? 503 : 500, missing ? 'CASH_SCHEMA_UNAVAILABLE' : 'TRANSACTIONS_FAILED', missing ? CASH_SCHEMA_MIGRATION_MESSAGE : 'Gagal memuat transaksi kas.');
    }
    return {
      data: result.data.map(mapCashTransaction),
      total: result.count,
      page,
      pageSize,
      totalPages: Math.ceil(result.count / pageSize) || 1,
    };
  }
}
