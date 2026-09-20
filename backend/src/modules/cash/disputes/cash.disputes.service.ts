import {
  CASH_SCHEMA_COMPATIBILITY_MESSAGE,
  CASH_SCHEMA_MIGRATION_MESSAGE,
  getBusinessTodayDate,
  isIsoDate,
  isMissingCashSchemaError,
  MAX_CASH_PROOF_URL_LENGTH,
  normalizePaymentMethodCode,
} from '../shared/cash.helpers.js';
import type { CashDisputesRepository } from './cash.disputes.repository.js';
import type { CashDisputeListQuery, CreateCashDisputeInput, ResolveCashDisputeInput } from './cash.disputes.types.js';
import type { CashRepositoryError } from '../shared/cash.types.js';

const DOMAIN_ERROR_CODES = [
  'DISPUTE_MONTHLY_QUOTA_EXHAUSTED',
  'DISPUTE_ALREADY_APPROVED',
  'DISPUTE_ALREADY_RESOLVED',
  'DISPUTE_DEBT_ALREADY_SETTLED',
  'DISPUTE_RESOLUTION_AMOUNT_INVALID',
  'DISPUTE_RESOLUTION_DATE_INVALID',
  'DISPUTE_RESOLUTION_NOT_APPLICABLE',
  'DISPUTE_RESOLUTION_REQUIRED',
  'DISPUTE_REVIEW_NOTE_INVALID',
  'DISPUTE_EVIDENCE_INVALID',
  'DISPUTE_REASON_INVALID',
  'DISPUTE_STATUS_INVALID',
  'DISPUTE_TARGET_FORBIDDEN',
  'DISPUTE_TARGET_NOT_FOUND',
  'DISPUTE_TARGET_SETTLED',
  'DISPUTE_TARGET_INVALID',
  'DISPUTE_ACTOR_INVALID',
  'DISPUTE_REVIEWER_INVALID',
  'DISPUTE_IDENTITY_INVALID',
  'DISPUTE_NOT_FOUND',
  'DISPUTE_PENDING',
  'IDEMPOTENCY_KEY_INVALID',
  'IDEMPOTENCY_KEY_REUSED',
  'INVALID_CURSOR',
] as const;

type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

const ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  DISPUTE_MONTHLY_QUOTA_EXHAUSTED: 'Kuota dua sanggahan untuk bulan ini sudah habis.',
  DISPUTE_ALREADY_APPROVED: 'Sanggahan untuk catatan ini sudah disetujui dan tidak dapat diajukan ulang.',
  DISPUTE_ALREADY_RESOLVED: 'Sanggahan ini sudah memiliki keputusan akhir.',
  DISPUTE_DEBT_ALREADY_SETTLED: 'Tunggakan sudah diselesaikan melalui transaksi lain.',
  DISPUTE_RESOLUTION_AMOUNT_INVALID: 'Nominal penyelesaian harus sama dengan nominal tunggakan yang diverifikasi.',
  DISPUTE_RESOLUTION_DATE_INVALID: 'Tanggal pembayaran terverifikasi tidak valid.',
  DISPUTE_RESOLUTION_NOT_APPLICABLE: 'Data penyelesaian pembayaran hanya berlaku untuk sanggahan tunggakan.',
  DISPUTE_RESOLUTION_REQUIRED: 'Tanggal, nominal, dan metode pembayaran wajib diisi saat menyetujui sanggahan tunggakan.',
  DISPUTE_REVIEW_NOTE_INVALID: 'Catatan pemeriksaan minimal 5 karakter.',
  DISPUTE_EVIDENCE_INVALID: 'Bukti sanggahan tidak valid atau terlalu besar.',
  DISPUTE_REASON_INVALID: 'Alasan sanggahan harus berisi 10 sampai 2.000 karakter.',
  DISPUTE_STATUS_INVALID: 'Status sanggahan tidak valid.',
  DISPUTE_TARGET_FORBIDDEN: 'Anda hanya dapat menyanggah catatan kas milik sendiri.',
  DISPUTE_TARGET_NOT_FOUND: 'Catatan kas masuk atau tunggakan tidak ditemukan.',
  DISPUTE_TARGET_SETTLED: 'Tunggakan ini sudah tercatat lunas.',
  DISPUTE_TARGET_INVALID: 'Pilih tepat satu transaksi atau tunggakan yang ingin disanggah.',
  DISPUTE_ACTOR_INVALID: 'Akun pengaju tidak aktif atau tidak ditemukan.',
  DISPUTE_REVIEWER_INVALID: 'Akun reviewer tidak aktif atau tidak memiliki peran yang sesuai.',
  DISPUTE_IDENTITY_INVALID: 'Identitas pengaju sanggahan tidak valid.',
  DISPUTE_NOT_FOUND: 'Sanggahan tidak ditemukan.',
  DISPUTE_PENDING: 'Sanggahan untuk catatan ini masih menunggu pemeriksaan.',
  IDEMPOTENCY_KEY_INVALID: 'Idempotency key sanggahan tidak valid.',
  IDEMPOTENCY_KEY_REUSED: 'Idempotency key sudah digunakan untuk pengajuan yang berbeda.',
  INVALID_CURSOR: 'Cursor daftar sanggahan tidak valid.',
};

export class CashDisputesServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CashDisputesServiceError';
  }
}

function domainCode(error: CashRepositoryError): DomainErrorCode | null {
  if (!error) return null;
  const source = `${error.code || ''} ${error.message || ''}`;
  return DOMAIN_ERROR_CODES.find((code) => source.includes(code)) || null;
}

function parseDetails(error: CashRepositoryError): unknown {
  if (!error?.details) return undefined;
  if (typeof error.details !== 'string') return error.details;
  try {
    return JSON.parse(error.details) as unknown;
  } catch {
    return undefined;
  }
}

function domainStatus(code: DomainErrorCode): number {
  if (code === 'DISPUTE_MONTHLY_QUOTA_EXHAUSTED') return 429;
  if (['DISPUTE_TARGET_FORBIDDEN'].includes(code)) return 403;
  if (['DISPUTE_TARGET_NOT_FOUND', 'DISPUTE_NOT_FOUND'].includes(code)) return 404;
  if ([
    'DISPUTE_PENDING', 'DISPUTE_ALREADY_APPROVED', 'DISPUTE_ALREADY_RESOLVED',
    'DISPUTE_DEBT_ALREADY_SETTLED', 'DISPUTE_TARGET_SETTLED', 'IDEMPOTENCY_KEY_REUSED',
  ].includes(code)) return 409;
  if (['DISPUTE_ACTOR_INVALID', 'DISPUTE_REVIEWER_INVALID', 'DISPUTE_IDENTITY_INVALID'].includes(code)) return 403;
  return 422;
}

function mapRepositoryError(error: CashRepositoryError, fallback: string): never {
  if (isMissingCashSchemaError(error)) throw new CashDisputesServiceError(503, 'CASH_SCHEMA_UNAVAILABLE', CASH_SCHEMA_MIGRATION_MESSAGE);
  if (error?.code === '23502') throw new CashDisputesServiceError(503, 'CASH_SCHEMA_INCOMPATIBLE', CASH_SCHEMA_COMPATIBILITY_MESSAGE);
  const code = domainCode(error);
  if (code) throw new CashDisputesServiceError(domainStatus(code), code, ERROR_MESSAGES[code], parseDetails(error));
  if (error?.code === 'DUPLICATE' || error?.code === '23505') throw new CashDisputesServiceError(409, 'DISPUTE_CONFLICT', 'Sanggahan bertabrakan dengan pengajuan lain. Muat ulang data dan coba lagi.');
  if (error?.code === 'NOT_FOUND' || error?.code === 'PGRST116') throw new CashDisputesServiceError(404, 'NOT_FOUND', fallback);
  throw new CashDisputesServiceError(500, 'DISPUTE_FAILED', fallback);
}

export class CashDisputesService {
  constructor(private readonly repository: CashDisputesRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async create(
    input: CreateCashDisputeInput,
    actorId: string,
    idempotencyKey: string,
    actorStudentId: string,
  ) {
    const transactionId = typeof input.transaction_id === 'string' ? input.transaction_id.trim() : '';
    const debtRecordId = typeof input.debt_record_id === 'string' ? input.debt_record_id.trim() : '';
    const reason = normalizeDisputeReason(input);
    const proofUrl = typeof input.bukti_sanggahan_url === 'string' ? input.bukti_sanggahan_url.trim() : '';
    const normalizedIdempotencyKey = idempotencyKey.trim();

    if ((!transactionId && !debtRecordId) || (transactionId && debtRecordId) || !reason || !proofUrl) {
      throw new CashDisputesServiceError(422, 'REQUIRED_FIELDS', 'Pilih satu catatan kas, isi alasan, dan lampirkan foto bukti sanggahan.');
    }
    if (reason.length < 10 || reason.length > 2000) throw new CashDisputesServiceError(422, 'DISPUTE_REASON_INVALID', ERROR_MESSAGES.DISPUTE_REASON_INVALID);
    if (proofUrl.length > MAX_CASH_PROOF_URL_LENGTH) throw new CashDisputesServiceError(422, 'DISPUTE_EVIDENCE_INVALID', ERROR_MESSAGES.DISPUTE_EVIDENCE_INVALID);
    if (normalizedIdempotencyKey.length < 8 || normalizedIdempotencyKey.length > 128) throw new CashDisputesServiceError(422, 'IDEMPOTENCY_KEY_INVALID', ERROR_MESSAGES.IDEMPOTENCY_KEY_INVALID);
    if (!actorStudentId) throw new CashDisputesServiceError(403, 'STUDENT_SCOPE_UNAVAILABLE', 'Akun belum terhubung ke data siswa aktif.');

    const target = transactionId
      ? await this.repository.findTransaction(transactionId)
      : await this.repository.findDebt(debtRecordId);
    if (target.error) mapRepositoryError(target.error, 'Gagal memeriksa catatan kas.');
    const record = target.data;
    if (!record || ('type' in record && record.type === 'pengeluaran') || !record.student_id) {
      throw new CashDisputesServiceError(404, 'DISPUTE_TARGET_NOT_FOUND', ERROR_MESSAGES.DISPUTE_TARGET_NOT_FOUND);
    }
    if ('status' in record && record.status !== 'unpaid') {
      throw new CashDisputesServiceError(409, 'DISPUTE_TARGET_SETTLED', ERROR_MESSAGES.DISPUTE_TARGET_SETTLED);
    }
    if (actorStudentId !== record.student_id) {
      throw new CashDisputesServiceError(403, 'DISPUTE_TARGET_FORBIDDEN', ERROR_MESSAGES.DISPUTE_TARGET_FORBIDDEN);
    }

    const result = await this.repository.createAtomic({
      transactionId: transactionId || undefined,
      debtRecordId: debtRecordId || undefined,
      studentId: record.student_id,
      reason,
      proofUrl,
      actorId,
      idempotencyKey: normalizedIdempotencyKey,
    });
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal mendaftarkan sanggahan kas.');
    return result.data;
  }

  async resolve(id: string, input: ResolveCashDisputeInput, actorId: string) {
    const status = input.status === 'resolved' ? 'approved' : input.status;
    const reviewNote = typeof input.review_note === 'string' ? input.review_note.trim() : '';
    const resolutionDate = typeof input.resolution_date === 'string' ? input.resolution_date.trim() : '';
    const resolutionAmount = typeof input.resolution_amount === 'number' ? input.resolution_amount : Number(input.resolution_amount);
    const paymentMethodCode = normalizePaymentMethodCode(input.payment_method_code);

    if (!id || (status !== 'approved' && status !== 'rejected')) throw new CashDisputesServiceError(422, 'DISPUTE_STATUS_INVALID', ERROR_MESSAGES.DISPUTE_STATUS_INVALID);
    if (reviewNote.length < 5 || reviewNote.length > 2000) throw new CashDisputesServiceError(422, 'DISPUTE_REVIEW_NOTE_INVALID', ERROR_MESSAGES.DISPUTE_REVIEW_NOTE_INVALID);
    if (resolutionDate && (!isIsoDate(resolutionDate) || resolutionDate > getBusinessTodayDate())) {
      throw new CashDisputesServiceError(422, 'DISPUTE_RESOLUTION_DATE_INVALID', ERROR_MESSAGES.DISPUTE_RESOLUTION_DATE_INVALID);
    }
    if (input.resolution_amount !== undefined && (!Number.isFinite(resolutionAmount) || resolutionAmount <= 0)) {
      throw new CashDisputesServiceError(422, 'DISPUTE_RESOLUTION_AMOUNT_INVALID', ERROR_MESSAGES.DISPUTE_RESOLUTION_AMOUNT_INVALID);
    }
    if (input.payment_method_code !== undefined && !paymentMethodCode) {
      throw new CashDisputesServiceError(422, 'INVALID_PAYMENT_METHOD', 'Metode pembayaran tidak valid.');
    }

    const result = await this.repository.reviewAtomic({
      id,
      status,
      reviewNote,
      actorId,
      resolutionDate: resolutionDate || undefined,
      resolutionAmount: Number.isFinite(resolutionAmount) ? resolutionAmount : undefined,
      paymentMethodCode: paymentMethodCode || undefined,
    });
    if (result.error || !result.data) mapRepositoryError(result.error, 'Sanggahan tidak ditemukan.');
    return result.data;
  }

  async getQuota(studentId: string) {
    const result = await this.repository.getQuota(studentId);
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal memuat kuota sanggahan kas.');
    return result.data;
  }

  async getEvidence(id: string, studentId: string | null) {
    if (!id) throw new CashDisputesServiceError(404, 'DISPUTE_NOT_FOUND', ERROR_MESSAGES.DISPUTE_NOT_FOUND);
    const result = await this.repository.getEvidence(id, studentId);
    if (result.error || !result.data) mapRepositoryError(result.error, 'Bukti sanggahan tidak ditemukan.');
    return result.data;
  }

  async list(query: CashDisputeListQuery, studentId: string | null) {
    const result = await this.repository.list(query, studentId);
    if (result.error) mapRepositoryError(result.error, 'Gagal memuat daftar sanggahan kas.');
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || query.limit) || 10));
    return {
      data: result.data,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
}

function normalizeDisputeReason(input: CreateCashDisputeInput): string {
  if (typeof input.alasan_sanggahan === 'string' && input.alasan_sanggahan.trim()) {
    return input.alasan_sanggahan.trim();
  }
  if (typeof input.reason === 'string') return input.reason.trim();
  return '';
}
