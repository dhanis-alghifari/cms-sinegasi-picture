import { getLocalDateInputValue } from '@/shared/utils/formatDate';

export type CashReportPreset = 7 | 30 | 90;

export function getTodayDate(): string {
  return getLocalDateInputValue();
}

export function getDateDaysBefore(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function getInclusiveDays(startDate: string, endDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return 0;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function getPresetRange(endDate: string, days: CashReportPreset): { startDate: string; endDate: string } {
  const safeEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : getTodayDate();
  return {
    endDate: safeEndDate,
    startDate: getDateDaysBefore(safeEndDate, days - 1),
  };
}
