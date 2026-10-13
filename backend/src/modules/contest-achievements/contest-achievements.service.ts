import { randomUUID } from 'node:crypto';
import { validateImageReference } from '../../shared/uploads/imageReference.js';
import { mapAchievementRepositoryError, cleanAchievementText, isOutcomeStatus, isResultKind, parseAchievementPagination } from './contest-achievements.helpers.js';
import type { ContestAchievementsRepository, ContestEntryResultInput, ContestAchievementListQuery, RecordContestResultInput, ContestResultKind, ContestOutcomeStatus } from './contest-achievements.types.js';

export class ContestAchievementsServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string, public readonly details?: unknown) { super(message); this.name = 'ContestAchievementsServiceError'; }
}

function required(value: unknown, field: string, maxLength: number): string {
  const text = cleanAchievementText(value, maxLength);
  if (!text) throw new ContestAchievementsServiceError(422, 'INVALID_INPUT', `${field} wajib diisi.`);
  return text;
}

function optionalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (!validateImageReference(value, { maxDecodedBytes: 675_000, maxLength: 900_000 }).valid) {
    throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_EVIDENCE_INVALID', 'Bukti hasil harus berupa unggahan gambar privat JPEG, PNG, atau WebP; URL publik tidak diizinkan.');
  }
  return text;
}

export class ContestAchievementsService {
  constructor(private readonly repository: ContestAchievementsRepository) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async list(query: ContestAchievementListQuery = {}) {
    const { page, pageSize } = parseAchievementPagination(query);
    const search = cleanAchievementText(query.search, 100);
    const resultKind = cleanAchievementText(query.result_kind, 32);
    if (resultKind && !isResultKind(resultKind)) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_KIND_INVALID', 'Filter jenis pencapaian tidak valid.');
    const position = query.position == null || query.position === '' ? undefined : Number.parseInt(query.position, 10);
    if (position !== undefined && (!Number.isInteger(position) || position < 1)) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_POSITION_INVALID', 'Posisi hasil harus bilangan positif.');
    const outcomeStatus = cleanAchievementText(query.outcome_status, 32);
    if (outcomeStatus && !isOutcomeStatus(outcomeStatus)) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_STATUS_INVALID', 'Status hasil tidak valid.');
    const tahunEvent = query.tahun_event == null || query.tahun_event === '' ? undefined : Number.parseInt(query.tahun_event, 10);
    if (tahunEvent !== undefined && (!Number.isInteger(tahunEvent) || tahunEvent < 1900 || tahunEvent > 2200)) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_YEAR_INVALID', 'Tahun event tidak valid.');
    const result = await this.repository.list({ search, resultKind: resultKind as ContestResultKind | undefined, position, outcomeStatus: outcomeStatus as ContestOutcomeStatus | undefined, tahunEvent, page, pageSize });
    if ('error' in result) mapAchievementRepositoryError(result.error, 'Gagal memuat rekap prestasi lomba.');
    return result;
  }

  async getDetail(entryId: string) {
    const normalizedEntryId = required(entryId, 'entry_id', 64);
    const result = await this.repository.getDetail(normalizedEntryId);
    if ('error' in result) mapAchievementRepositoryError(result.error, 'Gagal memuat detail prestasi karya.');
    if (!result.data) throw new ContestAchievementsServiceError(404, 'CONTEST_RESULT_NOT_FOUND', 'Rekap prestasi karya tidak ditemukan.');
    return result.data;
  }

  async record(entryId: string, input: RecordContestResultInput, actorId: string | null) {
    if (!actorId) throw new ContestAchievementsServiceError(503, 'DATABASE_IDENTITY_UNAVAILABLE', 'Akun login belum terhubung ke users.id database yang valid.');
    const normalizedEntryId = required(entryId, 'entry_id', 64);
    const outcome = required(input.outcome_status, 'outcome_status', 32);
    if (!isOutcomeStatus(outcome)) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_STATUS_INVALID', 'Status hasil tidak valid.');
    const reason = required(input.change_reason, 'change_reason', 500);
    const idempotencyKey = cleanAchievementText(input.idempotency_key, 128) || randomUUID();
    if (idempotencyKey.length < 8) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_IDEMPOTENCY_INVALID', 'Idempotency key tidak valid.');
    const rows = Array.isArray(input.results) ? input.results : [];
    if (rows.length > 20) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_ROWS_INVALID', 'Maksimal 20 hasil per karya.');
    if (outcome === 'awarded' && rows.length === 0) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_REQUIRED', 'Minimal satu hasil wajib diisi untuk karya berprestasi.');
    if (outcome !== 'awarded' && rows.length > 0) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_ROWS_INVALID', 'Hasil hanya boleh diisi saat statusnya mendapat penghargaan.');
    const normalizedRows: ContestEntryResultInput[] = rows.map((row) => {
      const kind = cleanAchievementText(row?.result_kind, 32);
      if (!isResultKind(kind)) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_KIND_INVALID', 'Jenis hasil tidak valid.');
      const title = required(row?.result_title, 'result_title', 200);
      const position = row?.position == null || (typeof row.position === 'string' && row.position === '') ? null : Number(row.position);
      if (position !== null && (!Number.isInteger(position) || position < 1 || position > 100000)) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_POSITION_INVALID', 'Posisi hasil harus bilangan positif.');
      if ((kind === 'rank' || kind === 'top_n') && position === null) throw new ContestAchievementsServiceError(422, 'CONTEST_RESULT_POSITION_INVALID', 'Posisi wajib untuk Juara atau Top N.');
      return { result_kind: kind, result_title: title, position, category_name: cleanAchievementText(row?.category_name, 160) ?? null, notes: cleanAchievementText(row?.notes, 2000) ?? null };
    });
    const evidenceUrl = optionalUrl(input.evidence_url);
    const result = await this.repository.record({ entryId: normalizedEntryId, outcomeStatus: outcome, results: normalizedRows, changeReason: reason, actorId, idempotencyKey, evidenceUrl });
    if ('error' in result) mapAchievementRepositoryError(result.error, 'Gagal menyimpan hasil prestasi karya.');
    return result.data;
  }
}
