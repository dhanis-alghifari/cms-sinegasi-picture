import type { ContestEntryStatus, ContestScope, ContestStatus } from '../types/contests.types';

export const CONTEST_SCOPE_OPTIONS: ReadonlyArray<{ value: ContestScope; label: string }> = [
  { value: 'bekasi', label: 'Bekasi' },
  { value: 'jabodetabek', label: 'Jabodetabek' },
  { value: 'jawa_barat', label: 'Provinsi Jawa Barat' },
  { value: 'nasional', label: 'Nasional' },
  { value: 'umum', label: 'Umum' },
];

export const CONTEST_SCOPE_LABELS: Record<ContestScope, string> = Object.fromEntries(
  CONTEST_SCOPE_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<ContestScope, string>;

export function normalizeContestScope(value: string | null | undefined): ContestScope | undefined {
  const aliases: Record<string, ContestScope> = {
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
  return value ? aliases[value.trim().toLowerCase()] : undefined;
}

export function getContestScopeLabel(scope: string | null | undefined): string {
  const normalized = normalizeContestScope(scope);
  return normalized ? CONTEST_SCOPE_LABELS[normalized] : 'Tingkat tidak tersedia';
}

export const CONTEST_STATUS_OPTIONS: ReadonlyArray<{ value: ContestStatus; label: string }> = [
  { value: 'buka', label: 'Pendaftaran dibuka' },
  { value: 'proses_penjurian', label: 'Proses Penjurian' },
  { value: 'selesai', label: 'Selesai' },
];

export const CONTEST_ENTRY_STATUS_OPTIONS: ReadonlyArray<{ value: ContestEntryStatus; label: string }> = [
  { value: 'proses_submit', label: 'Persiapan pengiriman' },
  { value: 'sudah_terkirim', label: 'Sudah terkirim' },
  { value: 'menunggu_pengumuman', label: 'Menunggu pengumuman' },
  { value: 'selesai', label: 'Selesai' },
];

export const CONTEST_STATUS_LABELS: Record<ContestStatus, string> = Object.fromEntries(
  CONTEST_STATUS_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<ContestStatus, string>;

export const CONTEST_ENTRY_STATUS_LABELS: Record<ContestEntryStatus, string> = Object.fromEntries(
  CONTEST_ENTRY_STATUS_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<ContestEntryStatus, string>;

export function getContestStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Status tidak tersedia';
  if (status === 'progres') return 'Proses Penjurian';
  return CONTEST_STATUS_LABELS[status as ContestStatus] ?? 'Status tidak tersedia';
}

export function getContestEntryStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Status tidak tersedia';
  return CONTEST_ENTRY_STATUS_LABELS[status as ContestEntryStatus] ?? 'Status tidak tersedia';
}

export const CONTEST_STATUS_BADGE_CLASSES: Record<ContestStatus, string> = {
  buka: 'bg-semantic-success/15 text-semantic-success border-semantic-success/30 font-semibold',
  proses_penjurian: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30 font-semibold',
  selesai: 'bg-surface-3 text-ink-tertiary border-hairline',
};

export function getContestStatusBadgeClass(status: string | null | undefined): string {
  if (status === 'progres') return CONTEST_STATUS_BADGE_CLASSES.proses_penjurian;
  return CONTEST_STATUS_BADGE_CLASSES[status as ContestStatus] ?? '';
}

export const CONTEST_SCOPE_BADGE_CLASSES: Record<ContestScope, string> = {
  bekasi: 'bg-surface-3 text-ink-subtle border-hairline',
  jabodetabek: 'bg-primary/15 text-primary border-primary/30',
  jawa_barat: 'bg-primary/15 text-primary border-primary/30',
  nasional: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30 font-bold',
  umum: 'bg-semantic-success/15 text-semantic-success border-semantic-success/30 font-bold',
};

export const CONTEST_ENTRY_STATUS_BADGE_CLASSES: Record<ContestEntryStatus, string> = {
  proses_submit: 'border-primary/30 bg-primary/10 text-primary',
  sudah_terkirim: 'border-semantic-success/30 bg-semantic-success/10 text-semantic-success',
  menunggu_pengumuman: 'border-semantic-warning/30 bg-semantic-warning/10 text-semantic-warning',
  selesai: 'border-surface-3 bg-surface-3 text-ink-subtle',
};
