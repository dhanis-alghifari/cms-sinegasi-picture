import { CASH_SCHEMA_MIGRATION_MESSAGE, isMissingCashSchemaError } from '../shared/cash.helpers.js';
import type { CashDisputesRepository } from './cash.disputes.repository.js';
import type { CreateCashDisputeInput, ResolveCashDisputeInput } from './cash.disputes.types.js';
import type { CashRepositoryError } from '../shared/cash.types.js';

export class CashDisputesServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'CashDisputesServiceError';
  }
}

function mapRepositoryError(error: CashRepositoryError, fallback: string): never {
  if (isMissingCashSchemaError(error)) throw new CashDisputesServiceError(503, 'CASH_SCHEMA_UNAVAILABLE', CASH_SCHEMA_MIGRATION_MESSAGE);
  if (error?.code === 'DUPLICATE' || error?.code === '23505') throw new CashDisputesServiceError(409, 'DISPUTE_EXISTS', 'Transaksi ini sudah pernah disanggah.');
  if (error?.code === 'NOT_FOUND' || error?.code === 'PGRST116') throw new CashDisputesServiceError(404, 'NOT_FOUND', fallback);
  throw new CashDisputesServiceError(400, 'DISPUTE_FAILED', fallback);
}

export class CashDisputesService {
  constructor(private readonly repository: CashDisputesRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async create(input: CreateCashDisputeInput, actorId: string, role: string, actorStudentId?: string) {
    const transactionId = typeof input.transaction_id === 'string' ? input.transaction_id.trim() : '';
    const reason = typeof input.alasan_sanggahan === 'string' && input.alasan_sanggahan.trim()
      ? input.alasan_sanggahan.trim()
      : typeof input.reason === 'string' ? input.reason.trim() : '';
    const proofUrl = typeof input.bukti_sanggahan_url === 'string' ? input.bukti_sanggahan_url.trim() : '';
    if (!transactionId || !reason || !proofUrl) throw new CashDisputesServiceError(422, 'REQUIRED_FIELDS', 'Transaksi, alasan, dan foto bukti sanggahan wajib diisi.');
    if (reason.length < 10) throw new CashDisputesServiceError(422, 'REASON_TOO_SHORT', 'Alasan sanggahan minimal 10 karakter.');
    if (reason.length > 2000 || proofUrl.length > 2000) throw new CashDisputesServiceError(422, 'INPUT_TOO_LONG', 'Alasan atau URL bukti sanggahan terlalu panjang.');

    const transactionResult = await this.repository.findTransaction(transactionId);
    if (transactionResult.error) mapRepositoryError(transactionResult.error, 'Gagal memeriksa transaksi kas.');
    const transaction = transactionResult.data;
    if (!transaction || transaction.type === 'pengeluaran' || !transaction.student_id) throw new CashDisputesServiceError(404, 'TRANSACTION_NOT_FOUND', 'Transaksi kas masuk tidak ditemukan.');
    if (role === 'member' && actorStudentId !== transaction.student_id) throw new CashDisputesServiceError(403, 'FORBIDDEN', 'Anda hanya dapat menyanggah transaksi milik sendiri.');

    const existing = await this.repository.findByTransaction(transactionId);
    if (existing.error) mapRepositoryError(existing.error, 'Gagal memeriksa sanggahan.');
    if (existing.data) throw new CashDisputesServiceError(409, 'DISPUTE_EXISTS', 'Transaksi ini sudah pernah disanggah.');
    const result = await this.repository.create({ transactionId, studentId: transaction.student_id, reason, proofUrl, actorId });
    if (result.error || !result.data) mapRepositoryError(result.error, 'Gagal mendaftarkan sanggahan kas.');
    return result.data;
  }

  async resolve(id: string, input: ResolveCashDisputeInput, actorId: string) {
    const status = input.status === 'resolved' ? 'approved' : input.status;
    if (!id || (status !== 'approved' && status !== 'rejected')) throw new CashDisputesServiceError(422, 'INVALID_STATUS', 'Status sanggahan tidak valid.');
    const result = await this.repository.update(id, status, actorId);
    if (result.error || !result.data) mapRepositoryError(result.error, 'Sanggahan tidak ditemukan.');
    return result.data;
  }
}
