import type { ContestRecord, ContestPublicStatus, ContestScope, ContestStatus } from './contests.types.js';
import { asDatabaseError } from '../../shared/database/database.types.js';

export const DEFAULT_CONTESTS: ContestRecord[] = [
  { id: 'cnt-001', nama: 'LKS Sinematografi Provinsi Jawa Tengah 2026', jenis: 'Sinematografi', level: 'provinsi', tanggal: '2026-09-15', status: 'progres', status_public: 'buka', hasil: null },
  {
    id: 'cnt-002',
    nama: 'Festival Film Pelajar Nasional SMAN Cup 2026',
    jenis: 'Short Film',
    level: 'nasional',
    tanggal: '2026-07-20',
    status: 'selesai',
    status_public: 'selesai',
    hasil: 'Juara 2 Kategori Sinematografi Terbaik',
  },
];

export const DEFAULT_WIN_RATE = [
  { tahun: 2026, level: 'provinsi', totalLomba: 2, totalSelesai: 0, totalMenang: 0, winRatePersen: 0 },
  { tahun: 2026, level: 'nasional', totalLomba: 1, totalSelesai: 1, totalMenang: 1, winRatePersen: 100 },
];

export function cleanText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, maxLength);
  return clean || null;
}

export function sanitizeSearch(value: unknown): string | undefined {
  const clean = cleanText(value, 100);
  if (!clean) return undefined;
  const safe = clean.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim();
  return safe || undefined;
}

/**
 * PostgREST's `.or()` accepts a filter expression rather than a bound value.
 * Keep the contest search alphabetic/numeric so punctuation cannot become a
 * second filter operator when interpolated into that expression.
 */
export function sanitizeContestSearch(value: unknown): string | undefined {
  const clean = sanitizeSearch(value);
  if (!clean) return undefined;
  const safe = clean.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return safe || undefined;
}

export function parsePagination(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(query.page || '1', 10) || 1));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function normalizeStatus(value: unknown): ContestStatus | undefined {
  const status = cleanText(value, 32);
  return status && status !== 'all' ? status : undefined;
}

export const CONTEST_SCOPE_CODES = ['bekasi', 'jabodetabek', 'jawa_barat', 'nasional', 'umum'] as const;

const PUBLIC_TO_LEGACY_STATUS: Record<string, ContestStatus> = {
  buka: 'progres',
  proses_penjurian: 'progres',
  selesai: 'selesai',
};

const PUBLIC_TO_LEGACY_LEVEL: Record<string, string> = {
  bekasi: 'kota',
  jabodetabek: 'provinsi',
  jawa_barat: 'provinsi',
  nasional: 'nasional',
  umum: 'nasional',
  lokal: 'kabupaten',
  regional: 'provinsi',
  internasional: 'internasional',
};

const LEGACY_TO_PUBLIC_LEVEL: Record<string, string> = {
  kabupaten: 'bekasi',
  kota: 'bekasi',
  provinsi: 'jawa_barat',
  nasional: 'nasional',
  internasional: 'umum',
};

const PUBLIC_SCOPE_ALIASES: Record<string, ContestScope> = {
  bekasi: 'bekasi',
  jabodetabek: 'jabodetabek',
  jawa_barat: 'jawa_barat',
  provinsi_jawa_barat: 'jawa_barat',
  nasional: 'nasional',
  umum: 'umum',
  lokal: 'bekasi',
  kabupaten: 'bekasi',
  kota: 'bekasi',
  regional: 'jawa_barat',
  provinsi: 'jawa_barat',
  internasional: 'umum',
};

export function normalizeContestStatus(value: unknown): ContestStatus | undefined {
  const status = normalizeStatus(value);
  return status ? PUBLIC_TO_LEGACY_STATUS[status] || status : undefined;
}

export function toPublicContestStatus(status: unknown, explicit?: unknown): ContestPublicStatus {
  const publicStatus = cleanText(explicit, 32);
  if (publicStatus === 'buka' || publicStatus === 'proses_penjurian' || publicStatus === 'selesai') {
    return publicStatus;
  }
  const requestedStatus = cleanText(status, 32);
  if (requestedStatus === 'buka' || requestedStatus === 'proses_penjurian' || requestedStatus === 'selesai') {
    return requestedStatus;
  }
  return normalizeStatus(status) === 'selesai' ? 'selesai' : 'proses_penjurian';
}

export function normalizeContestLevel(value: unknown): string | undefined {
  const level = cleanText(value, 32);
  if (!level) return undefined;
  return PUBLIC_TO_LEGACY_LEVEL[level.toLowerCase()] || level.toLowerCase();
}

export function normalizeContestScope(value: unknown): ContestScope | undefined {
  const scope = cleanText(value, 32)?.toLowerCase();
  if (!scope) return undefined;
  return PUBLIC_SCOPE_ALIASES[scope];
}

export function toPublicContestLevel(level: unknown): string {
  const normalized = cleanText(level, 32)?.toLowerCase() || '';
  return PUBLIC_SCOPE_ALIASES[normalized] || LEGACY_TO_PUBLIC_LEVEL[normalized] || String(level ?? '');
}

export function contestErrorMessage(error: unknown, fallback: string): string {
  const databaseError = asDatabaseError(error);
  if (databaseError?.code === '23505') return 'Data lomba atau pendaftaran film sudah ada.';
  if (databaseError?.code === '23503') return 'Lomba atau karya film yang dipilih tidak ditemukan.';
  if (databaseError?.message === 'CONTEST_SCOPE_INVALID') {
    return 'Tingkat lomba tidak valid.';
  }
  if (databaseError?.message === 'CONTEST_DEADLINE_MUST_BE_FUTURE' || (databaseError?.code === '22023' && /DEADLINE/i.test(databaseError.message || ''))) {
    return 'Deadline pendaftaran harus besok atau tanggal setelahnya.';
  }
  if (databaseError?.code === '42P01' || databaseError?.code === '42703' || databaseError?.code === 'PGRST204' || databaseError?.code === 'PGRST205') return 'Skema lomba belum terpasang atau belum dimuat ulang. Jalankan migration contest terlebih dahulu, lalu restart backend.';
  if (databaseError?.message?.trim() && !/[{}]/.test(databaseError.message)) return databaseError.message.trim();
  return fallback;
}
