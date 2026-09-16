
import type { CashReport } from '../types/cash.types';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import { getActiveCashReportDays } from './cashReportRows';

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function getControlStatus(control: CashReport['control']): string {
  if (!control) return 'Belum tersedia';
  if (control.is_balanced) return 'Seimbang';
  return 'Perlu pemeriksaan';
}

export function exportCashReportCsv(report: CashReport): void {
  const control = report.control;
  const incomeDetails = report.income_details ?? [];
  const expenseDetails = report.expense_details ?? [];
  const rows: unknown[][] = [
    ["Laporan Kas & Tunggakan"],
    [
      "Periode",
      report.period.start_date,
      report.period.end_date,
      `${report.period.days} hari`,
    ],
    [],
    ["Kontrol saldo", "Nilai"],
    ["Saldo awal periode", control?.opening_balance ?? ""],
    [
      "Net arus kas periode",
      control?.period_net_cash_flow ?? report.summary.net_cash_flow,
    ],
    ["Saldo akhir yang diharapkan", control?.expected_closing_balance ?? ""],
    ["Saldo akhir ledger", control?.closing_balance ?? ""],
    ["Selisih kontrol", control?.difference ?? ""],
    [
      "Status kontrol",
      getControlStatus(control),
    ],
    [],
    ["Ringkasan", "Nilai"],
    ["Total pemasukan", report.summary.total_income],
    ["Total pengeluaran", report.summary.total_expense],
    ["Net arus kas", report.summary.net_cash_flow],
    ["Total tunggakan", report.summary.outstanding_debt],
    ["Siswa menunggak", report.summary.delinquent_students],
    ["Jumlah transaksi", report.summary.transaction_count],
    [],
    ["Pemasukan berdasarkan metode pembayaran", "Total", "Jumlah transaksi"],
    ...(report.payment_method_breakdown ?? []).map((method) => [
      formatPaymentMethodLabel(method.key, method.label),
      method.total,
      method.count ?? 0,
    ]),
    [],
    ["Aktivitas harian", "Pemasukan", "Pengeluaran"],
    ...getActiveCashReportDays(report.daily).map((item) => [item.date, item.income, item.expense]),
    [],
    [
      "Rincian pemasukan",
      "Tanggal",
      "Jenis",
      "Nama siswa",
      "NIS",
      "Kelas",
      "Metode pembayaran",
      "Nominal",
      "Keterangan",
    ],
    ...incomeDetails.map((item) => [
      item.date,
      item.label || item.type || "",
      item.student_name || "",
      item.nis || "",
      item.kelas || "",
      formatPaymentMethodLabel(
        item.payment_method_code,
        item.payment_method_label,
      ),
      item.amount,
      item.note || "",
    ]),
    [],
    [
      "Rincian pengeluaran",
      "Tanggal",
      "Metode pembayaran",
      "Nominal",
      "Keterangan",
    ],
    ...expenseDetails.map((item) => [
      item.date,
      formatPaymentMethodLabel(
        item.payment_method_code,
        item.payment_method_label,
      ),
      item.amount,
      item.note || "",
    ]),
    [],
    [
      "Siswa menunggak",
      "NIS",
      "Kelas",
      "Total tunggakan",
      "Jumlah catatan",
      "Tunggakan tertua",
    ],
    ...report.debts.map((debt) => [
      debt.student_nama,
      debt.nis || "",
      debt.kelas || "",
      debt.total_debt,
      debt.debt_record_count,
      debt.oldest_debt_date || "",
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-kas-${report.period.start_date}-${report.period.end_date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
