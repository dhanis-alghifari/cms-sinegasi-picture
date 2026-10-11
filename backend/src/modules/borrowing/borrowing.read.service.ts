import type { BorrowingReadRepository } from './borrowing.read.repository.js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import type { BorrowingReadQuery, BorrowingReadScope } from './borrowing.read.types.js';

export class BorrowingReadServiceError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); this.name = 'BorrowingReadServiceError'; }
}

function sanitize(query: BorrowingReadQuery): BorrowingReadQuery {
  return { ...query, search: query.search?.trim().replace(/[%,_().\\*]/g, ' ').replace(/\s+/g, ' ').slice(0, 100) };
}

function isMissingBorrowingSchemaError(error: unknown): boolean {
  const databaseError = asDatabaseError(error);
  const code = databaseError?.code || '';
  const message = (databaseError?.message || '').toLowerCase();
  return code === 'PGRST202' || code === 'PGRST205'
    || (code === '42P01' && (message.includes('borrow') || message.includes('borrowing')))
    || (code === '42703' && (message.includes('borrow') || message.includes('borrowing')))
    || (code === '42883' && message.includes('borrow'));
}

export class BorrowingReadService {
  constructor(private readonly repository: BorrowingReadRepository) {}
  repositoryIsConfigured() { return this.repository.isConfigured(); }
  async list(query: BorrowingReadQuery, scope: BorrowingReadScope) {
    const allowed = [undefined, 'menunggu_persetujuan', 'disetujui', 'ditolak', 'dipinjam', 'menunggu_verifikasi', 'dikembalikan', 'terlambat'];
    if (!allowed.includes(query.status)) throw new BorrowingReadServiceError(422, 'Status peminjaman tidak valid.');
    const result = await this.repository.list(sanitize(query), scope);
    if (result.error || !result.data) throw new BorrowingReadServiceError(isMissingBorrowingSchemaError(result.error) ? 503 : 500, isMissingBorrowingSchemaError(result.error) ? 'Skema detail peminjaman belum tersedia. Jalankan migration borrowing lalu restart backend.' : 'Gagal memuat daftar peminjaman.');
    return result.data;
  }
  async summary(scope: BorrowingReadScope) {
    const result = await this.repository.summary(scope);
    if (result.error || !result.data) throw new BorrowingReadServiceError(isMissingBorrowingSchemaError(result.error) ? 503 : 500, isMissingBorrowingSchemaError(result.error) ? 'Skema detail peminjaman belum tersedia. Jalankan migration borrowing lalu restart backend.' : 'Gagal memuat ringkasan peminjaman.');
    return result.data;
  }
}
