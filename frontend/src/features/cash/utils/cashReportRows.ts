import type { CashReportDailyPoint } from '../types/cash.types';

export function hasCashActivity(item: CashReportDailyPoint): boolean {
  return item.income !== 0 || item.expense !== 0;
}

export function getActiveCashReportDays(rows: readonly CashReportDailyPoint[]): CashReportDailyPoint[] {
  return rows.filter(hasCashActivity);
}
