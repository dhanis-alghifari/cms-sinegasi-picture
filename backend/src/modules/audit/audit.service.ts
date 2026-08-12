import type { AuditListQuery, AuditLogRow, AuditPage, AuditRepository } from './audit.types.js';
import { auditErrorMessage, AuditQueryValidationError, isMissingAuditSchemaError, isUuid, mapAuditLogRow, normalizeAuditQuery } from './audit.helpers.js';

export class AuditServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'AuditServiceError';
  }
}

function mapRepositoryError(error: { code?: string; message?: string } | null, fallback: string): AuditServiceError {
  if (error?.code === 'DATABASE_UNAVAILABLE') return new AuditServiceError(503, 'DATABASE_UNAVAILABLE', 'Audit trail membutuhkan koneksi database.');
  if (isMissingAuditSchemaError(error)) {
    return new AuditServiceError(503, 'AUDIT_SCHEMA_UNAVAILABLE', 'Skema audit trail belum terpasang. Jalankan migration 017_audit_trail_hardening.sql.');
  }
  return new AuditServiceError(500, 'AUDIT_QUERY_FAILED', auditErrorMessage(error, fallback));
}

function page(data: AuditLogRow[], count: number, pagination: { page: number; pageSize: number }): AuditPage {
  return {
    data: data.map(mapAuditLogRow),
    total: count,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.max(1, Math.ceil(count / pagination.pageSize)),
  };
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async list(query: AuditListQuery = {}): Promise<AuditPage> {
    let parsed;
    try {
      parsed = normalizeAuditQuery(query);
    } catch (error) {
      if (error instanceof AuditQueryValidationError) throw new AuditServiceError(422, 'INVALID_AUDIT_FILTER', error.message);
      throw error;
    }
    const result = await this.repository.list(parsed);
    if (result.error) throw mapRepositoryError(result.error, 'Gagal memuat audit trail.');
    return page(result.data || [], result.count || 0, parsed);
  }

  async getEntry(id: string) {
    if (!isUuid(id)) throw new AuditServiceError(422, 'INVALID_AUDIT_ID', 'ID audit tidak valid.');
    const result = await this.repository.getEntry(id);
    if (result.error) throw mapRepositoryError(result.error, 'Gagal memuat detail audit.');
    if (!result.data) throw new AuditServiceError(404, 'AUDIT_NOT_FOUND', 'Catatan audit tidak ditemukan.');
    return mapAuditLogRow(result.data);
  }

  async listRecordHistory(tableName: string, recordId: string, query: AuditListQuery = {}): Promise<AuditPage> {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(tableName)) {
      throw new AuditServiceError(422, 'INVALID_TABLE_NAME', 'Nama tabel audit tidak valid.');
    }
    if (!recordId.trim() || recordId.length > 128) {
      throw new AuditServiceError(422, 'INVALID_RECORD_ID', 'ID record audit tidak valid.');
    }
    let parsed;
    try {
      parsed = normalizeAuditQuery(query);
    } catch (error) {
      if (error instanceof AuditQueryValidationError) throw new AuditServiceError(422, 'INVALID_AUDIT_FILTER', error.message);
      throw error;
    }
    const result = await this.repository.listRecordHistory(tableName, recordId.trim(), parsed);
    if (result.error) throw mapRepositoryError(result.error, 'Gagal memuat riwayat data.');
    return page(result.data || [], result.count || 0, parsed);
  }
}
