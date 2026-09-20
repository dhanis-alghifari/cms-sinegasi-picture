import { databaseErrorCode, databaseErrorMessage, type DatabaseRow } from '../../shared/database/database.types.js';
import type { AgendaActivity, AgendaPhoto } from './agenda.types.js';

export const MAX_AGENDA_FILTER_DAYS = 90;

export function cleanAgendaText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
  return text || undefined;
}

export function getJakartaDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

export function validAgendaDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value > getJakartaDate()) return undefined;
  return value;
}

export function isAgendaDateRangeWithinLimit(from: string, to: string): boolean {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const days = Math.floor((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000) + 1;
  return days <= MAX_AGENDA_FILTER_DAYS;
}

export function normalizePicNames(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return undefined;
    const name = cleanAgendaText(item, 100);
    if (!name || /[\u0000-\u001f\u007f]/.test(name)) return undefined;
    const key = name.toLocaleLowerCase('id-ID');
    if (!seen.has(key)) { seen.add(key); names.push(name); }
  }
  return names.length >= 1 && names.length <= 10 ? names : undefined;
}

function photo(row: unknown): AgendaPhoto | null {
  if (!row || typeof row !== 'object') return null;
  const value = row as DatabaseRow;
  return {
    id: String(value.id), activity_id: String(value.activity_id),
    object_key: value.object_key == null ? undefined : String(value.object_key),
    upload_status: String(value.upload_status || 'pending') as AgendaPhoto['upload_status'],
    mime_type: String(value.mime_type || ''), file_size_bytes: Number(value.file_size_bytes || 0),
    original_filename: String(value.original_filename || ''), created_at: String(value.created_at || ''),
  };
}

export function mapAgendaRow(row: DatabaseRow): AgendaActivity {
  const photos = Array.isArray(row.agenda_activity_photos) ? row.agenda_activity_photos as unknown[] : [];
  const attached = photos.find((item) => String((item as DatabaseRow)?.upload_status) === 'attached');
  return {
    id: String(row.id), activity_date: String(row.activity_date), activity_name: String(row.activity_name),
    activity_description: String(row.activity_description), instructor_name: String(row.instructor_name),
    pic_names: Array.isArray(row.pic_names) ? row.pic_names.map(String) : [], version: Number(row.version || 1),
    created_by: row.created_by == null ? null : String(row.created_by), updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: String(row.created_at), updated_at: String(row.updated_at), archived_by: row.archived_by == null ? null : String(row.archived_by), archived_at: row.archived_at == null ? null : String(row.archived_at),
    photo: photo(attached),
  };
}

export function mapAgendaPhoto(row: unknown): AgendaPhoto {
  const result = photo(row);
  if (!result) throw new Error('AGENDA_PHOTO_INVALID');
  return result;
}

export function parseAgendaPagination(query: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  return { page: Math.max(1, Math.min(10_000, Number.parseInt(query.page || '1', 10) || 1)), pageSize: Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20)) };
}

export function mapAgendaRepositoryError(error: unknown, fallback: string): never {
  const message = databaseErrorMessage(error)?.trim() || '';
  const code = databaseErrorCode(error);
  const statuses: Record<string, [number, string, string]> = {
    AGENDA_FUTURE_DATE_FORBIDDEN: [422, 'AGENDA_FUTURE_DATE_FORBIDDEN', 'Tanggal agenda tidak boleh di masa depan.'],
    AGENDA_DATE_RANGE_TOO_LARGE: [422, 'AGENDA_DATE_RANGE_TOO_LARGE', 'Rentang tanggal agenda maksimal 90 hari.'],
    AGENDA_INPUT_INVALID: [422, 'AGENDA_INPUT_INVALID', 'Data agenda belum valid.'],
    AGENDA_UPDATE_INPUT_INVALID: [422, 'AGENDA_UPDATE_INPUT_INVALID', 'Data perubahan agenda belum valid.'],
    AGENDA_ARCHIVE_INPUT_INVALID: [422, 'AGENDA_ARCHIVE_INPUT_INVALID', 'Data pengarsipan agenda belum valid.'],
    AGENDA_PIC_INVALID: [422, 'AGENDA_PIC_INVALID', 'Daftar PIC belum valid.'],
    AGENDA_NOT_FOUND: [404, 'AGENDA_NOT_FOUND', 'Agenda tidak ditemukan.'],
    AGENDA_VERSION_CONFLICT: [409, 'AGENDA_VERSION_CONFLICT', 'Agenda baru saja diubah pengguna lain. Muat ulang sebelum menyimpan.'],
    AGENDA_IDEMPOTENCY_REUSED: [409, 'AGENDA_IDEMPOTENCY_REUSED', 'Kunci idempotensi sudah digunakan untuk operasi lain.'],
    AGENDA_OPERATION_INCOMPLETE: [409, 'AGENDA_OPERATION_INCOMPLETE', 'Operasi sebelumnya belum selesai. Coba lagi dengan kunci baru.'],
    AGENDA_PHOTO_UPLOAD_IN_PROGRESS: [409, 'AGENDA_PHOTO_UPLOAD_IN_PROGRESS', 'Masih ada unggahan foto yang sedang diproses.'],
    AGENDA_PHOTO_INVALID: [422, 'AGENDA_PHOTO_INVALID', 'Foto agenda tidak valid atau sudah tidak dapat digunakan.'],
    AGENDA_PHOTO_INPUT_INVALID: [422, 'AGENDA_PHOTO_INPUT_INVALID', 'Metadata foto belum valid.'],
  };
  const known = statuses[message];
  if (known) throw Object.assign(new Error(known[2]), { statusCode: known[0], errorCode: known[1] });
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code || '')) throw Object.assign(new Error('Skema Agenda belum terpasang.'), { statusCode: 503, errorCode: 'AGENDA_SCHEMA_UNAVAILABLE' });
  throw Object.assign(new Error(message && !/[{}]/.test(message) ? message : fallback), { statusCode: 400, errorCode: 'AGENDA_REQUEST_FAILED' });
}
