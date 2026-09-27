import { runtimeConfig } from '../../config/env.js';
import type { BorrowingDatabaseError } from './borrowing.mutations.types.js';

export const BORROWING_SCHEMA_MIGRATION_MESSAGE = 'Skema peminjaman belum lengkap. Jalankan migration 014_borrowing_items_hardening.sql, 060_equipment_valuation_return_assessment.sql, 062_borrowing_return_evidence.sql, 063_equipment_recovery_and_charges.sql, 068_borrowing_self_return_verification.sql, dan 080_partial_borrowing_return_verification.sql di Supabase, lalu restart backend.';

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
    || message.includes('return_borrowing_atomic')
    || message.includes('reserve_borrowing_return_evidence_atomic')
    || message.includes('reserve_borrowing_self_return_evidence_atomic')
    || message.includes('submit_borrowing_self_return_atomic')
    || message.includes('verify_borrowing_self_return_atomic');
  return message.includes('function public.create_borrowing_atomic')
    || message.includes('relation "public.borrowing_items" does not exist')
    || message.includes('column "return_reported_at" does not exist')
    || message.includes('column "return_notes" does not exist')
    || message.includes('column "return_verified_at" does not exist')
    || message.includes('column "return_verified_by" does not exist');
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
  if (/return item conditions are required/i.test(message)) return 'Kondisi setiap alat yang dikembalikan wajib diisi.';
  if (/equipment is not part of the active borrowing/i.test(message)) return 'Alat tidak termasuk dalam peminjaman aktif ini.';
  if (/invalid return condition/i.test(message)) return 'Kondisi pengembalian alat tidak valid.';
  if (/good equipment cannot have a settlement charge/i.test(message)) return 'Alat dalam kondisi baik tidak boleh memiliki tagihan.';
  if (/lost equipment must use replacement settlement/i.test(message)) return 'Alat yang hilang harus menggunakan penyelesaian penggantian.';
  if (/replacement valuation is missing/i.test(message)) return 'Nilai penggantian alat belum dikonfigurasi.';
  if (/positive repair cost is required/i.test(message)) return 'Biaya perbaikan wajib diisi dengan nominal lebih dari nol.';
  if (/invalid settlement method/i.test(message)) return 'Metode penyelesaian tidak valid.';
  if (/return change reason must contain at least 5 characters/i.test(message)) return 'Alasan pengembalian wajib diisi minimal 5 karakter.';
  if (/borrowing not found/i.test(message)) return 'Data peminjaman tidak ditemukan.';
  if (/borrowing is not returnable/i.test(message)) return 'Peminjaman ini belum dapat diproses untuk pengembalian.';
  if (/every active borrowing item must be assessed/i.test(message)) return 'Semua alat dalam peminjaman aktif wajib diperiksa.';
  if (/return evidence is required|return_evidence_required|return evidence required/i.test(message)) return 'Foto kondisi wajib diunggah untuk setiap alat yang kembali.';
  if (/return evidence.*invalid|return_evidence_invalid/i.test(message)) return 'Foto kondisi tidak sesuai dengan alat atau peminjaman ini.';
  if (/return evidence.*upload incomplete|return_evidence_upload_incomplete/i.test(message)) return 'Unggahan foto kondisi belum selesai atau metadata file tidak sesuai.';
  if (/return_verification_item_not_active/i.test(message)) return 'Alat sudah dikembalikan atau tidak lagi menunggu verifikasi.';
  if (/return_verification_duplicate_item/i.test(message)) return 'Daftar alat yang diverifikasi tidak boleh berisi duplikasi.';
  if (/return_verification_conditions_required/i.test(message)) return 'Pilih minimal satu alat yang masih aktif untuk diverifikasi.';
  if (/return_verification_actor_forbidden/i.test(message)) return 'Hanya guru yang dapat memverifikasi pengembalian.';
  if (/return_verification_transition_invalid/i.test(message)) return 'Status laporan berubah. Muat ulang laporan sebelum memprosesnya.';
  if (/return_evidence_file_invalid/i.test(message)) return 'Foto kondisi harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 600 KB.';
  if (/return_evidence_actor_forbidden/i.test(message)) return 'Akun Anda tidak berwenang mengunggah foto kondisi.';
  if (/return_evidence_item_invalid/i.test(message)) return 'Alat tidak termasuk dalam peminjaman aktif ini.';
  if (/student_has_outstanding_equipment_charge/i.test(message)) return 'Peminjam masih memiliki tagihan alat yang belum lunas.';
  if (/return_evidence_object_key_reused/i.test(message)) return 'Unggahan foto ini sudah dipakai pada peminjaman lain.';
  if (message && !/[{};]/.test(message) && !/\b(SELECT|UPDATE|INSERT|DELETE|FROM|WHERE)\b/i.test(message)) return message;
  return 'Gagal memproses transaksi peminjaman.';
}

export function borrowingMutationStatus(error: BorrowingDatabaseError | null | undefined): number {
  const message = String(error?.message || '').toLowerCase();
  if (error?.code === '23505' || error?.code === 'ALREADY_PROCESSED' || error?.code === 'CONFLICT'
    || message.includes('return_verification_transition_invalid') || message.includes('return_verification_item_not_active')
    || message.includes('tidak tersedia') || message.includes('sudah diproses') || message.includes('dipesan')
    || message.includes('student_has_outstanding_equipment_charge')) return 409;
  if (error?.code === 'NOT_FOUND' || error?.code === 'PGRST116' || message.includes('tidak ditemukan')) return 404;
  if (isMissingBorrowingSchemaError(error)) return 503;
  if (message.includes('return_evidence_') || message.includes('return evidence')) return 422;
  return 400;
}
