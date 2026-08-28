import { databaseErrorCode, databaseErrorMessage } from '../../shared/database/database.types.js';
import { CONTEST_OUTCOME_STATUSES, CONTEST_RESULT_KINDS, type ContestOutcomeStatus, type ContestResultKind } from './contest-achievements.types.js';

export function cleanAchievementText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
  return text || undefined;
}

export function parseAchievementPagination(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(query.page || '1', 10) || 1));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20));
  return { page, pageSize };
}

export function isResultKind(value: unknown): value is ContestResultKind {
  return typeof value === 'string' && (CONTEST_RESULT_KINDS as readonly string[]).includes(value);
}

export function isOutcomeStatus(value: unknown): value is ContestOutcomeStatus {
  return typeof value === 'string' && (CONTEST_OUTCOME_STATUSES as readonly string[]).includes(value);
}

export function mapAchievementRepositoryError(error: unknown, fallback: string): never {
  const code = databaseErrorCode(error);
  const message = databaseErrorMessage(error)?.trim() || '';
  const business = new Set([
    'CONTEST_ENTRY_NOT_FOUND',
    'CONTEST_RESULT_ACTOR_INVALID',
    'CONTEST_RESULT_STATUS_INVALID',
    'CONTEST_RESULT_REASON_INVALID',
    'CONTEST_RESULT_IDEMPOTENCY_INVALID',
    'CONTEST_RESULT_ROWS_INVALID',
    'CONTEST_RESULT_REQUIRED',
    'CONTEST_RESULT_KIND_INVALID',
    'CONTEST_RESULT_TITLE_INVALID',
    'CONTEST_RESULT_POSITION_INVALID',
    'CONTEST_RESULT_CATEGORY_INVALID',
    'CONTEST_RESULT_NOTES_INVALID',
    'CONTEST_RESULT_EVIDENCE_INVALID',
    'CONTEST_RESULT_DUPLICATE',
    'CONTEST_RESULT_IDEMPOTENCY_REUSED',
    'CONTEST_RESULT_ACTOR_FORBIDDEN',
    'CONTEST_RESULT_NOT_FOUND',
  ]);
  if (business.has(message)) {
    const status = message === 'CONTEST_RESULT_IDEMPOTENCY_REUSED' ? 409 : message === 'CONTEST_RESULT_ACTOR_FORBIDDEN' ? 403 : message === 'CONTEST_RESULT_NOT_FOUND' ? 404 : 422;
    return fail(status, message, fallback);
  }
  if (message === 'CONTEST_RESULT_IDEMPOTENCY_REPLAY') return fail(200, message, fallback);
  if (code === '23505') return fail(409, 'CONTEST_RESULT_DUPLICATE', 'Hasil prestasi yang sama sudah tercatat.');
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code || '')) {
    return fail(503, 'CONTEST_RESULT_SCHEMA_UNAVAILABLE', 'Skema hasil prestasi belum terpasang atau belum dimuat ulang.');
  }
  return fail(400, 'CONTEST_RESULT_FAILED', message && !/[{}]/.test(message) ? message : fallback);
}

function fail(statusCode: number, errorCode: string, message: string): never {
  throw Object.assign(new Error(message), { statusCode, errorCode, name: 'ContestAchievementsServiceError' });
}
