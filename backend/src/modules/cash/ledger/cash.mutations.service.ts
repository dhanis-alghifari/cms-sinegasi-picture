import { CASH_SCHEMA_MIGRATION_MESSAGE, getBusinessTodayDate, isIsoDate, isMissingCashSchemaError, normalizePaymentMethodCode, MAX_CASH_PROOF_URL_LENGTH, validateCashProofUrl } from '../shared/cash.helpers.js';
import type { CashInInput, CashOutInput } from './cash.mutations.types.js';
import type { CashMutationsRepository, CashMutationResult } from './cash.mutations.repository.js';
import type { CashRepositoryError } from '../shared/cash.types.js';

export class CashMutationsServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'CashMutationsServiceError';
  }
}

function mapRepositoryError(error: CashRepositoryError, fallback: string): never {
  if (isMissingCashSchemaError(error)) throw new CashMutationsServiceError(503, 'CASH_SCHEMA_UNAVAILABLE', CASH_SCHEMA_MIGRATION_MESSAGE);
  const insufficientBalanceMessage = 'Saldo kas tidak mencukupi untuk pengeluaran ini.';
  // The deployed RPC raises this exact business exception with SQLSTATE P0001.
  // Do not expose arbitrary database messages or classify every P0001 as a client error.
  const insufficientBalance = error?.code === 'INSUFFICIENT_BALANCE'
    || (error?.code === 'P0001' && error.message === insufficientBalanceMessage);
  if (insufficientBalance) throw new CashMutationsServiceError(400, 'INSUFFICIENT_BALANCE', insufficientBalanceMessage);
  const code = error?.code || 'CASH_MUTATION_FAILED';
  let statusCode = 500;
  if (['INVALID_PAYMENT_METHOD', 'STUDENT_NOT_FOUND', 'FUTURE_DEBT'].includes(code)) statusCode = 422;
  else if (code === '23505' || code === 'DUPLICATE') statusCode = 409;
  throw new CashMutationsServiceError(statusCode, code, statusCode >= 500 ? fallback : error?.message || fallback);
}

function resolveIdempotencyKey(
  requestKey: unknown,
  inputKey: unknown,
  prefix: string,
  actorId: string,
): string {
  if (typeof requestKey === 'string' && requestKey.trim()) return requestKey.trim();
  if (typeof inputKey === 'string' && inputKey.trim()) return inputKey.trim();
  return `${prefix}-${actorId}-${crypto.randomUUID()}`;
}

export class CashMutationsService {
  constructor(private readonly repository: CashMutationsRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async recordIn(input: CashInInput, actorId: string, requestIdempotencyKey?: string, changeReason = 'Pencatatan transaksi kas masuk'): Promise<CashMutationResult> {
    const nominal = Number(input.nominal ?? input.jumlah);
    const keterangan = typeof input.keterangan === 'string' && input.keterangan.trim() ? input.keterangan.trim() : 'Iuran kas';
    const type = input.type || (input.student_id ? 'iuran_wajib' : 'pemasukan');
    const tanggal = input.tanggal === undefined ? getBusinessTodayDate() : input.tanggal;
    const studentId = typeof input.student_id === 'string' && input.student_id.trim() ? input.student_id.trim() : null;
    const paymentMethodCode = (input.metode_pembayaran === null || input.metode_pembayaran === undefined) || (typeof input.metode_pembayaran === 'string' && input.metode_pembayaran.trim() === '')
      ? null
      : normalizePaymentMethodCode(input.metode_pembayaran);
    if (typeof input.foto_bukti_url === 'string' && input.foto_bukti_url.length > MAX_CASH_PROOF_URL_LENGTH) {
      throw new CashMutationsServiceError(422, 'PROOF_TOO_LONG', 'URL foto bukti terlalu panjang. Pilih foto yang lebih kecil.');
    }
    if (typeof input.foto_bukti_url === 'string' && input.foto_bukti_url.trim() && !validateCashProofUrl(input.foto_bukti_url)) {
      throw new CashMutationsServiceError(422, 'INVALID_INPUT', 'Foto bukti harus berupa JPG, PNG, atau WebP base64 yang valid, atau URL http(s) tanpa kredensial.');
    }
    if (!Number.isFinite(nominal) || nominal < 0 || nominal > 9_999_999_999.99) throw new CashMutationsServiceError(422, 'INVALID_AMOUNT', 'Nominal kas masuk harus nol atau angka positif yang valid dan tidak melebihi batas sistem.');
    if (!isIsoDate(tanggal)) throw new CashMutationsServiceError(422, 'INVALID_DATE', 'Tanggal transaksi harus berupa tanggal kalender yang valid (YYYY-MM-DD).');
    if (type !== 'iuran_wajib' && type !== 'pemasukan') throw new CashMutationsServiceError(422, 'INVALID_TYPE', 'Tipe pemasukan kas tidak valid.');
    if (nominal === 0 && type !== 'iuran_wajib') throw new CashMutationsServiceError(422, 'INVALID_AMOUNT', 'Pemasukan lain-lain harus memiliki nominal lebih besar dari nol.');
    if (nominal > 0 && !paymentMethodCode) throw new CashMutationsServiceError(422, 'PAYMENT_METHOD_REQUIRED', 'Metode pembayaran wajib dipilih.');
    if (nominal === 0 && paymentMethodCode) throw new CashMutationsServiceError(422, 'PAYMENT_METHOD_NOT_ALLOWED', 'Metode pembayaran dikosongkan jika iuran belum dibayar.');
    if (type === 'iuran_wajib' && !studentId) throw new CashMutationsServiceError(422, 'STUDENT_REQUIRED', 'Siswa wajib dipilih untuk pembayaran iuran.');
    const idempotencyKey = resolveIdempotencyKey(requestIdempotencyKey, input.idempotency_key, 'ci', actorId);
    const result = await this.repository.recordCashIn({
      studentId, nominal, keterangan, type: type as 'iuran_wajib' | 'pemasukan', tanggal,
      fotoBuktiUrl: typeof input.foto_bukti_url === 'string' ? input.foto_bukti_url : undefined,
      actorId, idempotencyKey, changeReason, paymentMethodCode,
    });
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal mencatat pemasukan kas.');
    return result.data;
  }

  async recordOut(input: CashOutInput, actorId: string, requestIdempotencyKey?: string, changeReason = 'Pencatatan transaksi kas keluar'): Promise<CashMutationResult> {
    const nominal = Number(input.nominal ?? input.jumlah);
    const keterangan = typeof input.keterangan === 'string' ? input.keterangan.trim() : '';
    const paymentMethodCode = input.metode_pembayaran === undefined ? 'cash' : normalizePaymentMethodCode(input.metode_pembayaran);
    if (typeof input.foto_bukti_url === 'string' && input.foto_bukti_url.length > MAX_CASH_PROOF_URL_LENGTH) {
      throw new CashMutationsServiceError(422, 'PROOF_TOO_LONG', 'URL foto bukti terlalu panjang. Pilih foto yang lebih kecil.');
    }
    if (typeof input.foto_bukti_url === 'string' && input.foto_bukti_url.trim() && !validateCashProofUrl(input.foto_bukti_url)) {
      throw new CashMutationsServiceError(422, 'INVALID_INPUT', 'Foto bukti harus berupa JPG, PNG, atau WebP base64 yang valid, atau URL http(s) tanpa kredensial.');
    }
    if (!Number.isFinite(nominal) || nominal <= 0 || !keterangan) throw new CashMutationsServiceError(422, 'INVALID_INPUT', 'nominal dan keterangan wajib diisi.');
    if (!paymentMethodCode) throw new CashMutationsServiceError(422, 'INVALID_PAYMENT_METHOD', 'Metode pembayaran tidak valid.');
    const idempotencyKey = resolveIdempotencyKey(requestIdempotencyKey, input.idempotency_key, 'co', actorId);
    const result = await this.repository.recordCashOut({
      nominal, keterangan, paymentMethodCode, actorId, idempotencyKey, changeReason,
      fotoBuktiUrl: typeof input.foto_bukti_url === 'string' ? input.foto_bukti_url : undefined,
    });
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal mencatat pengeluaran kas.');
    return result.data;
  }
}
