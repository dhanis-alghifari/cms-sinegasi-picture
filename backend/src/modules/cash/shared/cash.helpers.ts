import type { CashTransactionRecord } from './cash.types.js';

export const CASH_SCHEMA_MIGRATION_MESSAGE = 'Skema kas belum terpasang. Jalankan "npm run db:migrate:cash" di folder backend, lalu restart backend.';

export function isMissingCashSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (
    ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(error.code || '')
    || error.message?.includes('cash_settings')
    || error.message?.includes('cash_payment_methods')
    || error.message?.includes('payment_method_id')
    || error.message?.includes('record_cash_in_atomic')
    || error.message?.includes('record_cash_in_on_date_atomic')
    || error.message?.includes('record_cash_out_atomic')
    || error.message?.includes('record_cash_in_on_date_with_method_atomic')
    || error.message?.includes('record_cash_in_with_status_atomic')
    || error.message?.includes('record_cash_out_with_method_atomic')
    || error.message?.includes('get_cash_summary')
    || error.message?.includes('get_cash_report')
    || error.message?.includes('get_cash_report_with_method')
  ));
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getBusinessTodayDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

export function normalizePaymentMethodCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(code) ? code : null;
}

export function normalizePaymentMethodLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.trim().replace(/\s+/g, ' ');
  return label.length >= 1 && label.length <= 80 ? label : null;
}

const standardPaymentMethodLabels: Readonly<Record<string, string>> = {
  cash: 'Cash',
  qris_dana: 'QRIS DANA',
  qris_gopay: 'QRIS GoPay',
};

export function formatPaymentMethodLabel(code: unknown, label?: unknown): string {
  const normalizedCode = normalizePaymentMethodCode(code);
  const normalizedLabel = typeof label === 'string' ? label.trim().replace(/\s+/g, ' ') : '';
  if (normalizedLabel && normalizedLabel.toLowerCase() !== normalizedCode) return normalizedLabel;
  return (normalizedCode && standardPaymentMethodLabels[normalizedCode]) || normalizedLabel || 'Metode tidak tersedia';
}

export function mapCashTransaction(row: CashTransactionRecord): Record<string, unknown> {
  const type = row.type === 'pengeluaran' ? 'keluar' : 'masuk';
  const studentValue = row.students;
  const student = Array.isArray(studentValue) ? studentValue[0] : studentValue;
  const paymentMethodValue = row.cash_payment_methods;
  const paymentMethod = Array.isArray(paymentMethodValue) ? paymentMethodValue[0] : paymentMethodValue;
  const legacyCash = !paymentMethod && row.payment_method_id == null;
  const paymentMethodCode = paymentMethod?.code || row.payment_method_code || (legacyCash ? 'cash' : undefined);
  const disputeRows = row.cash_disputes;
  const dispute = row.dispute || (Array.isArray(disputeRows) ? disputeRows[0] : undefined);

  return {
    id: row.id,
    student_id: row.student_id,
    student_nama: student?.nama,
    tipe: type,
    jumlah: Number(row.nominal || 0),
    keterangan: row.keterangan,
    foto_bukti_url: row.foto_bukti_url,
    tanggal: row.tanggal || row.created_at,
    idempotency_key: row.idempotency_key,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_by: row.updated_by,
    updated_at: row.updated_at || row.created_at,
    is_billing: row.is_billing === true,
    metode_pembayaran: paymentMethodCode,
    metode_pembayaran_label: paymentMethodCode ? formatPaymentMethodLabel(paymentMethodCode, paymentMethod?.label || row.payment_method_label) : undefined,
    dispute: dispute
      ? {
          id: dispute.id,
          transaction_id: dispute.transaction_id,
          reason: dispute.reason || dispute.alasan_sanggahan,
          bukti_sanggahan_url: dispute.bukti_sanggahan_url,
          status: dispute.status === 'approved' ? 'resolved' : dispute.status,
          created_at: dispute.created_at,
        }
      : undefined,
  };
}
