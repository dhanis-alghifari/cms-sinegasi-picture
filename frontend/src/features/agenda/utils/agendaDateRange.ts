export const MAX_AGENDA_FILTER_DAYS = 90;

interface AgendaDateRangeValues {
  from: string;
  to: string;
}

function utcDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getAgendaDateRangeError({ from, to }: AgendaDateRangeValues): string | undefined {
  if (!from && !to) return undefined;
  if (!from || !to) return 'Pilih tanggal mulai dan selesai untuk memakai rentang tanggal.';
  if (from > to) return 'Tanggal mulai harus sama atau sebelum tanggal selesai.';

  const days = Math.floor((utcDay(to) - utcDay(from)) / 86_400_000) + 1;
  if (days > MAX_AGENDA_FILTER_DAYS) return `Rentang tanggal maksimal ${MAX_AGENDA_FILTER_DAYS} hari.`;
  return undefined;
}

export function formatAgendaReportPeriod(from: string | undefined, to: string | undefined, rows: Array<{ activity_date: string }>): string {
  const dates = rows.map((row) => row.activity_date).sort();
  const start = from || dates[0];
  const end = to || dates[dates.length - 1] || start;
  if (!start || !end) return 'Semua periode';

  const formatMonthYear = (value: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
  const startLabel = formatMonthYear(start);
  const endLabel = formatMonthYear(end);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}
