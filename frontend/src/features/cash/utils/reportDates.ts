import { getLocalDateInputValue } from '@/shared/utils/formatDate';
import { UI_CONSTANTS } from '@/shared/constants/ui';

const WEEK_REPORT_DAYS = 7;
const MONTH_REPORT_DAYS = 30;

export const CASH_REPORT_PRESET_DAYS = [WEEK_REPORT_DAYS, MONTH_REPORT_DAYS, UI_CONSTANTS.MAX_CASH_REPORT_RANGE_DAYS] as const;
export type CashReportPreset = typeof CASH_REPORT_PRESET_DAYS[number];

const MILLISECONDS_PER_DAY = 86_400_000;

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
  return Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY) + 1;
}

export function getPresetRange(endDate: string, days: CashReportPreset): { startDate: string; endDate: string } {
  const safeEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : getTodayDate();
  return {
    endDate: safeEndDate,
    startDate: getDateDaysBefore(safeEndDate, days - 1),
  };
}
