import {
  CONTEST_ENTRY_STATUS_VALUES,
  CONTEST_FINALIZE_RESULT_KIND_VALUES,
  CONTEST_OUTCOME_STATUS_VALUES,
  CONTEST_RESULT_KIND_VALUES,
  CONTEST_SCOPE_VALUES,
  CONTEST_STATUS_VALUES,
  WORK_TYPE_VALUES,
  type ContestEntryStatus,
  type ContestFinalizeResultKind,
  type ContestOutcomeStatus,
  type ContestResultKind,
  type ContestScope,
  type ContestStatus,
  type ContestWorkTypeOption,
  type WorkTypeCode,
} from '../types/contests.types';

export const CONTEST_SCOPE_LABELS = {
  bekasi: 'Bekasi',
  jabodetabek: 'Jabodetabek',
  jawa_barat: 'Provinsi Jawa Barat',
  nasional: 'Nasional',
  umum: 'Umum',
} satisfies Record<ContestScope, string>;

export const CONTEST_SCOPE_OPTIONS: ReadonlyArray<{ value: ContestScope; label: string }> = CONTEST_SCOPE_VALUES
  .map((value) => ({ value, label: CONTEST_SCOPE_LABELS[value] }));

export function isContestScope(value: string | null | undefined): value is ContestScope {
  return CONTEST_SCOPE_OPTIONS.some((option) => option.value === value);
}

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

export const CONTEST_STATUS_LABELS = {
  buka: 'Pendaftaran dibuka',
  proses_penjurian: 'Proses Penjurian',
  selesai: 'Selesai',
} satisfies Record<ContestStatus, string>;

export const CONTEST_STATUS_OPTIONS: ReadonlyArray<{ value: ContestStatus; label: string }> = CONTEST_STATUS_VALUES
  .map((value) => ({ value, label: CONTEST_STATUS_LABELS[value] }));

export const CONTEST_ENTRY_STATUS_LABELS = {
  proses_submit: 'Persiapan pengiriman',
  sudah_terkirim: 'Sudah terkirim',
  menunggu_pengumuman: 'Menunggu pengumuman',
  selesai: 'Selesai',
} satisfies Record<ContestEntryStatus, string>;

export const CONTEST_ENTRY_STATUS_OPTIONS: ReadonlyArray<{ value: ContestEntryStatus; label: string }> = CONTEST_ENTRY_STATUS_VALUES
  .map((value) => ({ value, label: CONTEST_ENTRY_STATUS_LABELS[value] }));

export const CONTEST_WORK_TYPE_LABELS = {
  short_film: 'Film Pendek',
  documentary: 'Dokumenter',
  photography: 'Fotografi',
  animation: 'Animasi',
  commercial: 'Iklan / Komersial',
  music_video: 'Video Musik',
  experimental: 'Eksperimental',
  other: 'Lainnya',
} satisfies Record<WorkTypeCode, string>;

export const CONTEST_WORK_TYPE_OPTIONS: ReadonlyArray<ContestWorkTypeOption> = WORK_TYPE_VALUES
  .map((code) => ({ code, label: CONTEST_WORK_TYPE_LABELS[code] }));

export const CONTEST_RESULT_KIND_LABELS = {
  rank: 'Juara / peringkat',
  top_n: 'Top N',
  special_award: 'Penghargaan khusus',
  finalist: 'Finalis',
  nominee: 'Nominasi',
  honorable_mention: 'Honorable mention',
  other: 'Lainnya',
} satisfies Record<ContestResultKind, string>;

export const CONTEST_RESULT_KIND_OPTIONS: ReadonlyArray<{ value: ContestResultKind; label: string }> = CONTEST_RESULT_KIND_VALUES
  .map((value) => ({ value, label: CONTEST_RESULT_KIND_LABELS[value] }));

export const CONTEST_FINALIZE_RESULT_KIND_LABELS = {
  rank: 'Juara',
  finalist: 'Finalis',
  nominee: 'Nominasi',
  other: 'Lainnya',
} satisfies Record<ContestFinalizeResultKind, string>;

export const CONTEST_FINALIZE_RESULT_KIND_OPTIONS: ReadonlyArray<{ value: ContestFinalizeResultKind; label: string }> = CONTEST_FINALIZE_RESULT_KIND_VALUES
  .map((value) => ({ value, label: CONTEST_FINALIZE_RESULT_KIND_LABELS[value] }));

export const CONTEST_OUTCOME_STATUS_LABELS = {
  pending: 'Menunggu hasil',
  awarded: 'Mendapat penghargaan',
  not_awarded: 'Tidak mendapat penghargaan',
} satisfies Record<ContestOutcomeStatus, string>;

export const CONTEST_OUTCOME_STATUS_OPTIONS: ReadonlyArray<{ value: ContestOutcomeStatus; label: string }> = CONTEST_OUTCOME_STATUS_VALUES
  .map((value) => ({ value, label: CONTEST_OUTCOME_STATUS_LABELS[value] }));

export function isContestResultKind(value: string | null | undefined): value is ContestResultKind {
  return CONTEST_RESULT_KIND_VALUES.some((candidate) => candidate === value);
}

export function isContestOutcomeStatus(value: string | null | undefined): value is ContestOutcomeStatus {
  return CONTEST_OUTCOME_STATUS_VALUES.some((candidate) => candidate === value);
}

export function getContestResultKindLabel(kind: ContestResultKind): string {
  return CONTEST_RESULT_KIND_LABELS[kind];
}

export function getContestFinalizeResultKindLabel(kind: ContestFinalizeResultKind): string {
  return CONTEST_FINALIZE_RESULT_KIND_LABELS[kind];
}

export function getContestOutcomeStatusLabel(status: ContestOutcomeStatus): string {
  return CONTEST_OUTCOME_STATUS_LABELS[status];
}

export const CONTEST_ACHIEVEMENT_BADGE_LABELS = {
  pending: 'Menunggu hasil',
  awarded: 'Berprestasi',
  not_awarded: 'Tidak mendapat penghargaan',
} satisfies Record<ContestOutcomeStatus, string>;

export const CONTEST_OUTCOME_BADGE_CLASSES: Record<ContestOutcomeStatus, string> = {
  pending: 'border-semantic-warning/30 bg-semantic-warning/10 text-semantic-warning',
  awarded: 'border-semantic-success/30 bg-semantic-success/10 text-semantic-success',
  not_awarded: 'border-hairline text-ink-tertiary',
};

export function getContestAchievementBadgeLabel(status: ContestOutcomeStatus): string {
  return CONTEST_ACHIEVEMENT_BADGE_LABELS[status];
}

export function getContestOutcomeBadgeClass(status: ContestOutcomeStatus): string {
  return CONTEST_OUTCOME_BADGE_CLASSES[status];
}

export function getContestResultDisplayLabel(
  kind: ContestResultKind | null,
  title: string,
  position?: number | null,
): string {
  if (kind === 'rank' && position) {
    if (title.toLowerCase() === `juara ${position}`.toLowerCase()) return title;
    return formatContestResultTitle(`Juara ${position}`, title);
  }
  if (kind === 'top_n' && position) {
    if (title.toLowerCase() === `${position} besar`.toLowerCase()) return title;
    return formatContestResultTitle(`${position} besar`, title);
  }
  return title;
}

function formatContestResultTitle(prefix: string, title: string): string {
  if (!title) return prefix;
  return `${prefix} · ${title}`;
}

export function isContestStatus(value: string | null | undefined): value is ContestStatus {
  return CONTEST_STATUS_OPTIONS.some((option) => option.value === value);
}

export function isContestEntryStatus(value: string | null | undefined): value is ContestEntryStatus {
  return CONTEST_ENTRY_STATUS_OPTIONS.some((option) => option.value === value);
}

export function getContestStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Status tidak tersedia';
  if (status === 'progres') return 'Proses Penjurian';
  return isContestStatus(status) ? CONTEST_STATUS_LABELS[status] : 'Status tidak tersedia';
}

export function getContestEntryStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Status tidak tersedia';
  return isContestEntryStatus(status) ? CONTEST_ENTRY_STATUS_LABELS[status] : 'Status tidak tersedia';
}

export const CONTEST_STATUS_BADGE_CLASSES: Record<ContestStatus, string> = {
  buka: 'bg-semantic-success/15 text-semantic-success border-semantic-success/30 font-semibold',
  proses_penjurian: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30 font-semibold',
  selesai: 'bg-surface-3 text-ink-tertiary border-hairline',
};

export function getContestStatusBadgeClass(status: string | null | undefined): string {
  if (status === 'progres') return CONTEST_STATUS_BADGE_CLASSES.proses_penjurian;
  return isContestStatus(status) ? CONTEST_STATUS_BADGE_CLASSES[status] : '';
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
