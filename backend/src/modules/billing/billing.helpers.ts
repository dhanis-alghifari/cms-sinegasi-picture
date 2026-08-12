import type { BillingResult } from './billing.types.js';

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeBillingResult(value: unknown): BillingResult {
  const result = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const billingWeek = typeof result.billing_week === 'string'
    ? result.billing_week
    : typeof result.billingWeek === 'string'
      ? result.billingWeek
      : undefined;

  return {
    studentsBilled: Number(result.students_billed ?? result.studentsBilled ?? 0),
    totalNominal: Number(result.total_nominal ?? result.totalNominal ?? 0),
    status: String(result.status ?? 'unknown'),
    billingWeek,
  };
}

export const DATABASE_UNAVAILABLE_BILLING_RESULT: BillingResult = {
  studentsBilled: 0,
  totalNominal: 0,
  status: 'database_unavailable',
};
