import crypto from 'node:crypto';
import type { JwtPayload } from '../../shared/auth/auth.types.js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import { borrowingMutationStatus, getBorrowingErrorMessage, isIsoDate, isMissingBorrowingSchemaError } from './borrowing.helpers.js';
import type { BorrowingMutationsRepository } from './borrowing.mutations.repository.js';
import type { BorrowingApprovalInput, BorrowingCreateInput, BorrowingReturnInput } from './borrowing.mutations.types.js';

export class BorrowingMutationsServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BorrowingMutationsServiceError';
  }
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function repositoryFailure(error: unknown, fallback: string): never {
  const databaseError = asDatabaseError(error);
  const schemaUnavailable = isMissingBorrowingSchemaError(databaseError);
  const statusCode = schemaUnavailable ? 503 : borrowingMutationStatus(databaseError);
  const errorCode = schemaUnavailable ? 'BORROWING_SCHEMA_UNAVAILABLE' : databaseError?.code || 'BORROWING_MUTATION_FAILED';
  throw new BorrowingMutationsServiceError(statusCode, errorCode, schemaUnavailable ? getBorrowingErrorMessage(databaseError) : (getBorrowingErrorMessage(databaseError) || fallback), error);
}

function ensureId(value: unknown, field: string): string {
  const normalized = nonEmpty(value);
  if (!normalized || normalized.length > 128) throw new BorrowingMutationsServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  return normalized;
}

function ensureDate(value: unknown, field: string): string {
  const normalized = nonEmpty(value);
  if (!normalized || !isIsoDate(normalized)) throw new BorrowingMutationsServiceError(422, 'INVALID_DATE', `${field} harus berupa tanggal kalender yang valid (YYYY-MM-DD).`);
  return normalized;
}

export class BorrowingMutationsService {
  constructor(private readonly repository: BorrowingMutationsRepository) {}

  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async create(input: BorrowingCreateInput, actor: Pick<JwtPayload, 'userId' | 'role'>, memberStudentId: string | null, actorId: string, requestIdempotencyKey?: string) {
    const studentId = ensureId(input.student_id || input.borrower_id, 'student_id');
    if (actor.role === 'member' && (!memberStudentId || memberStudentId !== studentId)) {
      throw new BorrowingMutationsServiceError(403, 'FORBIDDEN', 'Siswa hanya boleh mengajukan peminjaman untuk dirinya sendiri.');
    }
    const equipmentIds = Array.isArray(input.equipment_ids) ? input.equipment_ids.map((value) => ensureId(value, 'equipment_id')) : [];
    if (equipmentIds.length === 0) throw new BorrowingMutationsServiceError(422, 'EQUIPMENT_REQUIRED', 'Minimal satu alat wajib dipilih.');
    if (new Set(equipmentIds).size !== equipmentIds.length) throw new BorrowingMutationsServiceError(422, 'DUPLICATE_EQUIPMENT', 'Daftar alat tidak boleh berisi duplikasi.');
    if (equipmentIds.length > 50) throw new BorrowingMutationsServiceError(422, 'TOO_MANY_EQUIPMENT', 'Maksimal 50 alat dapat diajukan dalam satu peminjaman.');

    const tanggalPinjam = input.tanggal_pinjam ? ensureDate(input.tanggal_pinjam, 'tanggal_pinjam') : new Date().toISOString().slice(0, 10);
    const rencanaKembali = ensureDate(input.rencana_kembali || input.due_at?.slice(0, 10), 'rencana_kembali');
    if (rencanaKembali < tanggalPinjam) throw new BorrowingMutationsServiceError(422, 'INVALID_DATE_RANGE', 'Rencana tanggal pengembalian harus sama atau setelah tanggal peminjaman.');
    const keperluan = nonEmpty(input.keperluan || input.keterangan);
    if (!keperluan || keperluan.length < 5 || keperluan.length > 500) throw new BorrowingMutationsServiceError(422, 'INVALID_PURPOSE', 'Keperluan peminjaman minimal 5 dan maksimal 500 karakter.');
    const idempotencyKey = nonEmpty(requestIdempotencyKey) || nonEmpty(input.idempotency_key) || `bor-${actor.userId}-${crypto.randomUUID()}`;
    const result = await this.repository.create({ studentId, equipmentIds, tanggalPinjam, rencanaKembali, keperluan, actorId, idempotencyKey });
    if (result.error) repositoryFailure(result.error, 'Pengajuan peminjaman gagal disimpan.');
    if (!result.data) throw new BorrowingMutationsServiceError(500, 'BORROWING_DETAIL_UNAVAILABLE', 'Pengajuan tersimpan tetapi detailnya gagal dimuat.');
    return result.data;
  }

  async approveReject(borrowingId: string, input: BorrowingApprovalInput, actorId: string) {
    const id = ensureId(borrowingId, 'borrowing_id');
    if (input.action !== 'approve' && input.action !== 'reject') throw new BorrowingMutationsServiceError(422, 'INVALID_ACTION', 'Aksi persetujuan tidak valid.');
    const changeReason = nonEmpty(input.change_reason) || nonEmpty(input.alasan);
    if (!changeReason || changeReason.length < 5) throw new BorrowingMutationsServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan keputusan minimal 5 karakter.');
    const catatan = nonEmpty(input.catatan);
    const result = await this.repository.approveReject({ borrowingId: id, action: input.action, catatan, actorId, changeReason });
    if (result.error) repositoryFailure(result.error, 'Keputusan peminjaman gagal diproses.');
    if (!result.data) throw new BorrowingMutationsServiceError(404, 'NOT_FOUND', 'Peminjaman tidak ditemukan.');
    return result.data;
  }

  async handover(borrowingId: string, actorId: string, changeReason: string) {
    const id = ensureId(borrowingId, 'borrowing_id');
    const reason = nonEmpty(changeReason);
    if (!reason || reason.length < 5) throw new BorrowingMutationsServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan serah-terima minimal 5 karakter.');
    const result = await this.repository.handover({ borrowingId: id, actorId, changeReason: reason });
    if (result.error) repositoryFailure(result.error, 'Serah-terima peminjaman gagal diproses.');
    if (!result.data) throw new BorrowingMutationsServiceError(404, 'NOT_FOUND', 'Peminjaman tidak ditemukan.');
    return result.data;
  }

  async returnBorrowing(borrowingId: string, input: BorrowingReturnInput, actorId: string, headerChangeReason?: string) {
    const id = ensureId(borrowingId, 'borrowing_id');
    const reason = nonEmpty(headerChangeReason) || nonEmpty(input.change_reason);
    if (!reason || reason.length < 5) throw new BorrowingMutationsServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan pengembalian minimal 5 karakter.');
    const itemConditions = Array.isArray(input.item_conditions) ? input.item_conditions : [];
    if (itemConditions.length === 0) throw new BorrowingMutationsServiceError(422, 'ITEM_CONDITIONS_REQUIRED', 'Kondisi setiap alat wajib diisi.');
    if (new Set(itemConditions.map((item) => item.equipment_id)).size !== itemConditions.length) throw new BorrowingMutationsServiceError(422, 'DUPLICATE_EQUIPMENT', 'Kondisi alat tidak boleh duplikat.');
    const returnedAt = input.tanggal_dikembalikan ? ensureDate(input.tanggal_dikembalikan, 'tanggal_dikembalikan') : new Date().toISOString().slice(0, 10);
    const catatan = nonEmpty(input.catatan_pengembalian);
    for (const item of itemConditions) {
      ensureId(item.equipment_id, 'equipment_id');
      if (nonEmpty(item.kondisi_kembali) === null) throw new BorrowingMutationsServiceError(422, 'INVALID_CONDITION', 'Kondisi setiap alat wajib diisi.');
    }
    const result = await this.repository.returnBorrowing({ borrowingId: id, returnedAt, itemConditions, catatan, actorId, changeReason: reason });
    if (result.error) repositoryFailure(result.error, 'Pengembalian peminjaman gagal diproses.');
    if (!result.data) throw new BorrowingMutationsServiceError(404, 'NOT_FOUND', 'Peminjaman tidak ditemukan.');
    return result.data;
  }
}
