import { runtimeConfig } from '../../config/env.js';
import type { BorrowingDatabaseError } from './borrowing.mutations.types.js';

export const BORROWING_SCHEMA_MIGRATION_MESSAGE = 'Skema detail peminjaman belum terpasang. Jalankan query migration 014_borrowing_items_hardening.sql di Supabase, lalu restart backend.';

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isMissingBorrowingSchemaError(error: BorrowingDatabaseError | null | undefined): boolean {
  if (!error) return false;
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  if (code === 'PGRST202' || code === 'PGRST205') return true;
  if (code === '42P01') return message.includes('borrowing') || message.includes('borrow');
  if (code === '42703') return message.includes('borrowing') || message.includes('borrow');
  if (code === '42883') return message.includes('create_borrowing_atomic')
    || message.includes('approve_borrowing_atomic')
    || message.includes('handover_borrowing_atomic')
    || message.includes('return_borrowing_atomic');
  return message.includes('function public.create_borrowing_atomic')
    || message.includes('relation "public.borrowing_items" does not exist');
}

export function getBorrowingErrorMessage(error: BorrowingDatabaseError | null | undefined): string {
  if (isMissingBorrowingSchemaError(error)) {
    if (runtimeConfig.environment === 'production' || !error) return BORROWING_SCHEMA_MIGRATION_MESSAGE;
    const diagnostic = [error.code, error.message, error.details, error.hint]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' | ');
    return diagnostic ? `${BORROWING_SCHEMA_MIGRATION_MESSAGE} Detail: ${diagnostic}` : BORROWING_SCHEMA_MIGRATION_MESSAGE;
  }

  if (error?.code === '23505') return 'Peminjaman dengan data yang sama sudah tercatat.';
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (message && !/[{};]/.test(message) && !/\b(SELECT|UPDATE|INSERT|DELETE|FROM|WHERE)\b/i.test(message)) return message;
  return 'Gagal memproses transaksi peminjaman.';
}

export function borrowingMutationStatus(error: BorrowingDatabaseError | null | undefined): number {
  const message = String(error?.message || '').toLowerCase();
  if (error?.code === '23505' || error?.code === 'ALREADY_PROCESSED' || error?.code === 'CONFLICT'
    || message.includes('tidak tersedia') || message.includes('sudah diproses') || message.includes('dipesan')) return 409;
  if (error?.code === 'NOT_FOUND' || error?.code === 'PGRST116' || message.includes('tidak ditemukan')) return 404;
  if (isMissingBorrowingSchemaError(error)) return 503;
  return 400;
}
