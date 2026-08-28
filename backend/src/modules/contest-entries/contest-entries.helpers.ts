import type { DatabaseRow } from '../../shared/database/database.types.js';
import type { ContestEntryRecord, ContestEntryStatus, MediaWorkRecord } from './contest-entries.types.js';

export function cleanEntryText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, maxLength);
  return clean || null;
}

export function parseEntryPagination(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(query.page || '1', 10) || 1));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function isEntryStatus(value: unknown): value is ContestEntryStatus {
  return value === 'proses_submit'
    || value === 'sudah_terkirim'
    || value === 'menunggu_pengumuman'
    || value === 'selesai';
}

export function mapWork(row: DatabaseRow | null | undefined): MediaWorkRecord | undefined {
  if (!row || row.id == null) return undefined;
  const type = row.work_type_code ?? row.type_code;
  const typeReference = row.work_types as DatabaseRow | DatabaseRow[] | undefined;
  const typeRow = Array.isArray(typeReference) ? typeReference[0] : typeReference;
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    work_type_code: String(type ?? 'other'),
    work_type_label: row.work_type_label == null && typeRow?.label == null
      ? undefined
      : String(row.work_type_label ?? typeRow?.label),
    description: row.description == null ? null : String(row.description),
    duration_minutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
    production_year: row.production_year == null ? null : Number(row.production_year),
    primary_asset_url: row.primary_asset_url == null ? null : String(row.primary_asset_url),
    video_url: row.video_url == null ? null : String(row.video_url),
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: row.created_at == null ? undefined : String(row.created_at),
  };
}

export function mapEntry(row: DatabaseRow): ContestEntryRecord {
  const workRow = (row.work ?? row.media_works) as DatabaseRow | DatabaseRow[] | undefined;
  const work = Array.isArray(workRow) ? mapWork(workRow[0]) : mapWork(workRow);
  return {
    id: String(row.id),
    contest_id: String(row.contest_id),
    work_id: String(row.work_id),
    pipeline_status: String(row.pipeline_status ?? 'proses_submit') as ContestEntryStatus,
    outcome_status: row.outcome_status == null ? undefined : String(row.outcome_status) as ContestEntryRecord['outcome_status'],
    result_label: row.result_label == null ? null : String(row.result_label),
    result_note: row.result_note == null ? null : String(row.result_note),
    submitted_at: row.submitted_at == null ? null : String(row.submitted_at),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
    work,
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: row.created_at == null ? undefined : String(row.created_at),
    updated_at: row.updated_at == null ? undefined : String(row.updated_at),
  };
}

export function entryErrorMessage(error: unknown, fallback: string): string {
  const row = error as { code?: unknown; message?: unknown } | null;
  const businessMessages: Record<string, string> = {
    CONTEST_NOT_FOUND: 'Event lomba tidak ditemukan.',
    WORK_NOT_FOUND: 'Karya yang dipilih tidak ditemukan.',
    WORK_TYPE_INVALID: 'Jenis karya tidak tersedia atau sudah dinonaktifkan.',
    WORK_TITLE_INVALID: 'Judul karya harus berisi 2 sampai 200 karakter.',
    CONTEST_ENTRY_ALREADY_EXISTS: 'Karya tersebut sudah terdaftar pada event ini.',
    ENTRY_STATUS_INVALID: 'Status pipeline karya tidak valid.',
    ENTRY_EVIDENCE_REQUIRED: 'Bukti pengiriman atau hasil wajib diisi untuk status ini.',
    ENTRY_RESULT_REQUIRED: 'Hasil akhir wajib diisi untuk status selesai.',
    CHANGE_REASON_REQUIRED: 'Alasan perubahan wajib diisi minimal 5 karakter.',
    CONTEST_ENTRY_ACTOR_INVALID: 'Akun pengubah tidak aktif atau tidak valid.',
  };
  if (typeof row?.message === 'string' && businessMessages[row.message]) return businessMessages[row.message];
  if (row?.code === '23505') return 'Karya tersebut sudah terdaftar pada event ini.';
  if (row?.code === '23503') return 'Event atau karya yang dipilih tidak ditemukan.';
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(row?.code ?? ''))) {
    return 'Skema karya lomba belum terpasang. Jalankan migration contest terbaru lalu reload schema.';
  }
  return typeof row?.message === 'string' && !/[{}]/.test(row.message) ? row.message : fallback;
}
