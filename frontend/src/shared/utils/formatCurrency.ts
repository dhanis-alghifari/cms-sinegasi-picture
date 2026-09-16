// Display convention: `Rp 3,450,000` and `Rp 10,000.75`.

import { formatNumber, toFiniteNumber, type NumericValue } from './formatNumber';

export function formatCurrency(amount: NumericValue): string {
  const parsed = toFiniteNumber(amount);
  if (parsed === null) return 'Rp 0';

  const sign = parsed < 0 ? '-' : '';
  return `${sign}Rp ${formatNumber(Math.abs(parsed))}`;
}

export function formatCurrencyCompact(amount: NumericValue): string {
  const parsed = toFiniteNumber(amount) ?? 0;
  const sign = parsed < 0 ? '-' : '';
  const absolute = Math.abs(parsed);

  if (absolute >= 1_000_000) {
    return `${sign}Rp ${formatNumber(absolute / 1_000_000, { maximumFractionDigits: 1 })}jt`;
  }
  if (absolute >= 1_000) {
    return `${sign}Rp ${formatNumber(absolute / 1_000, { maximumFractionDigits: 0 })}rb`;
  }
  return formatCurrency(parsed);
}
