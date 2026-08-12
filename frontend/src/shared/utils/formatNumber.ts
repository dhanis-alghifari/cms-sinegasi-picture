// Shared numeric formatting for display and numeric form inputs.
// Display convention: comma for thousands and dot for decimals.

export type NumericValue = number | string | null | undefined;

export interface NumberFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

const formatterCache = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat('en-US', {
    ...DEFAULT_NUMBER_FORMAT,
    minimumFractionDigits,
    maximumFractionDigits,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

function normalizeNumericString(value: string): string {
  return value.replace(/,/g, '').trim();
}

export function toFiniteNumber(value: NumericValue): number | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed = typeof value === 'number' ? value : Number(normalizeNumericString(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: NumericValue, options: NumberFormatOptions = {}): string {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return options.fallback ?? '0';

  const minimumFractionDigits = options.minimumFractionDigits ?? DEFAULT_NUMBER_FORMAT.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options.maximumFractionDigits ?? DEFAULT_NUMBER_FORMAT.maximumFractionDigits ?? 2;
  return getNumberFormatter(minimumFractionDigits, maximumFractionDigits).format(parsed);
}

/** Parse a formatted text input without changing the API payload type. */
export function parseNumericInput(value: string): number | undefined {
  const parsed = toFiniteNumber(value);
  return parsed === null ? undefined : parsed;
}

/** Value shown in a numeric input when it is not focused. */
export function formatNumberInput(value: NumericValue): string {
  return value === null || value === undefined || value === '' ? '' : formatNumber(value);
}
