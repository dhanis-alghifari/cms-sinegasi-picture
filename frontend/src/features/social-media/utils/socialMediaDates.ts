import type { SocialMediaDateFilters } from '../types/socialMedia.types';

const MAX_REPORT_DAYS = 366;

export function getJakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export function getDefaultSocialDateRange(days = 30): SocialMediaDateFilters {
  const to = getJakartaToday();
  const date = new Date(`${to}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - Math.max(1, days - 1));
  return { from: date.toISOString().slice(0, 10), to };
}

export function getSocialDateRangeError({ from, to }: SocialMediaDateFilters): string | null {
  if (!from || !to) return 'Tanggal awal dan akhir wajib diisi.';
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const today = new Date(`${getJakartaToday()}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Format tanggal tidak valid.';
  if (start > end) return 'Tanggal awal tidak boleh melewati tanggal akhir.';
  if (end > today) return 'Tanggal akhir tidak boleh di masa depan.';
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days > MAX_REPORT_DAYS) return 'Laporan dibatasi maksimal 366 hari. Persempit rentang tanggal.';
  return null;
}

export function formatSocialDateRange({ from, to }: SocialMediaDateFilters): string {
  if (!from || !to) return 'Pilih rentang tanggal';
  const format = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
  return `${format(from)} – ${format(to)}`;
}
