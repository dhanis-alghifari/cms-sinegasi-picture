
function toValidDate(value: string | Date): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(date: string | Date): string {
  const parsed = toValidDate(date);
  if (!parsed) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateShort(date: string | Date): string {
  const parsed = toValidDate(date);
  if (!parsed) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateTime(date: string | Date): string {
  const parsed = toValidDate(date);
  if (!parsed) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

/** Returns today's date in the browser's local timezone for `<input type="date">`. */
export function getLocalDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns a future date for date inputs (used for deadlines that cannot be backdated). */
export function getFutureDateInputValue(days = 1, date = new Date()): string {
  const target = new Date(date);
  target.setDate(target.getDate() + days);
  return getLocalDateInputValue(target);
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = toValidDate(date);
  if (!target) return '-';

  const diffMs = now.getTime() - target.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return formatDateShort(date);
}

export function isOverdue(dueDate: string | Date): boolean {
  const parsed = toValidDate(dueDate);
  return parsed ? parsed < new Date() : false;
}
