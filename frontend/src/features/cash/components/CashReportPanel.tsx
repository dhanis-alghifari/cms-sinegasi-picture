import { useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatNumber } from '@/shared/utils/formatNumber';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import type { ReportPrintFormat } from '@/shared/types/report';
import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { ReportFormatSelector } from '@/shared/ui/report/ReportFormatSelector';
import { ReportPreviewDialog } from '@/shared/ui/report/ReportPreviewDialog';

import type { CashPaymentMethod, CashReport, CashReportDailyPoint } from '../types/cash.types';
import { CashReportDailyPrintTable } from './CashReportDailyPrintTable';
import { CashReportDebtTable } from './CashReportDebtTable';
import { CashReportDebtMobileList } from './CashReportDebtMobileList';
import { CashReportDetailTable } from './CashReportDetailTable';
import { CashReportDetailMobileList } from './CashReportDetailMobileList';
import { CashReportFilter } from './CashReportFilter';
import { CashReportPreview } from './CashReportPreview';
import { getActiveCashReportDays } from '../utils/cashReportRows';
import type { CashReportPreset } from '../utils/reportDates';

interface CashReportPanelProps {
  report: {
    data?: CashReport;
    isLoading: boolean;
    error?: unknown;
    rangeError?: string;
  };
  filters: {
    startDate: string;
    endDate: string;
    paymentMethodCode: string;
    paymentMethods: CashPaymentMethod[];
    isPaymentMethodsLoading?: boolean;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onPaymentMethodChange: (value: string) => void;
    onPreset: (days: CashReportPreset) => void;
    onReset: () => void;
  };
  actions: {
    onExportCsv: () => void;
    onPrintPdf: (format: ReportPrintFormat) => void;
  };
}

function BreakdownRows({
  rows,
  emptyLabel,
  labelFormatter,
}: {
  rows: CashReport['income_breakdown'];
  emptyLabel: string;
  labelFormatter?: (row: CashReport['income_breakdown'][number]) => string;
}) {
  const max = Math.max(...rows.map((row) => row.total), 1);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-ink-tertiary">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((row) => (
        <div key={`${row.key}-${row.label}`} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-ink-subtle">{labelFormatter ? labelFormatter(row) : row.label}</span>
            <span className="shrink-0 font-semibold text-ink">{formatCurrency(row.total)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((row.total / max) * 100, 3)}%` }}
            />
          </div>
          <p className="text-[10px] text-ink-tertiary">{formatNumber(row.count ?? 0)} transaksi</p>
        </div>
      ))}
      {rows.length > 8 && <p className="text-[10px] text-ink-tertiary">Menampilkan 8 kategori terbesar.</p>}
    </div>
  );
}

export function CashReportPanel({
  report: reportState,
  filters,
  actions,
}: CashReportPanelProps) {
  const { data: report, isLoading, error, rangeError } = reportState;
  const {
    startDate,
    endDate,
    paymentMethodCode,
    paymentMethods,
    isPaymentMethodsLoading = false,
    onStartDateChange,
    onEndDateChange,
    onPaymentMethodChange,
    onPreset,
    onReset,
  } = filters;
  const { onExportCsv, onPrintPdf } = actions;
  const isMobile = useIsMobile();
  const summary = report?.summary;
  const control = report?.control;
  const income = summary?.total_income ?? 0;
  const expense = summary?.total_expense ?? 0;
  const flowTotal = income + expense || 1;
  const incomePercent = Math.round((income / flowTotal) * 100);
  const daily = report?.daily ?? [];
  const activeDaily = getActiveCashReportDays(daily);
  const visibleDaily = getActiveCashReportDays(daily.slice(-14));
  const maxDaily = Math.max(...visibleDaily.flatMap((item) => [item.income, item.expense]), 1);
  const incomeDetails = report?.income_details ?? [];
  const expenseDetails = report?.expense_details ?? [];
  const [printFormat, setPrintFormat] = useState<ReportPrintFormat>('a4');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const controlContent = (() => {
    if (!control) {
      const unavailableLabel = paymentMethodCode
        ? 'Kontrol saldo hanya tersedia saat semua metode pembayaran dipilih.'
        : 'Kontrol saldo belum tersedia. Jalankan migration laporan kas terbaru.';
      return <p className="text-ink-tertiary">{unavailableLabel}</p>;
    }

    const balanceStatusLabel = control.is_balanced
      ? '✓ Ledger seimbang'
      : '⚠ Perlu pemeriksaan ledger';
    const balanceStatusClass = control.is_balanced
      ? 'font-semibold text-semantic-success'
      : 'font-semibold text-semantic-danger';

    return (
      <>
        <ControlRow label="Saldo awal periode" value={control.opening_balance} />
        <ControlRow label="Saldo akhir diharapkan" value={control.expected_closing_balance} />
        <ControlRow label="Saldo akhir ledger" value={control.closing_balance} />
        <ControlRow label="Selisih" value={control.difference} />
        <p className={balanceStatusClass}>{balanceStatusLabel}</p>
      </>
    );
  })();

  const debtReportContent = (() => {
    if (!report) {
      return null;
    }
    if (report.debts.length === 0) {
      return <p className="px-4 pb-5 text-center text-xs text-ink-tertiary">Tidak ada siswa menunggak pada periode ini.</p>;
    }
    return isMobile
      ? <CashReportDebtMobileList debts={report.debts} />
      : <CashReportDebtTable debts={report.debts} />;
  })();

  const handlePrintPreview = () => {
    setIsPreviewOpen(false);
    window.setTimeout(() => onPrintPdf(printFormat), UI_CONSTANTS.DEFERRED_ACTION_MS);
  };

  return (
    <div id="cash-report-print" className="space-y-4">
      <div className="cash-report-screen-only">
        <CashReportFilter
          report={report}
          filter={{
            startDate,
            endDate,
            paymentMethodCode,
            paymentMethods,
            isPaymentMethodsLoading,
            rangeError,
          }}
          actions={{
            onStartDateChange,
            onEndDateChange,
            onPaymentMethodChange,
            onPreset,
            onReset,
          }}
        />
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Memuat laporan">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-surface-2" />)}
        </div>
      )}

      {Boolean(error) && !isLoading && (
        <Card className="border-semantic-danger/30 bg-semantic-danger/10">
          <CardContent className="pt-5 text-xs text-semantic-danger">
            {getErrorMessage(error)}
          </CardContent>
        </Card>
      )}

      {report && !rangeError && !isLoading && !error && (
        <>
          <div className="cash-report-page space-y-4">
            <div className="cash-report-print-only hidden">
              <h1 className="text-xl font-semibold text-ink">Laporan Kas &amp; Tunggakan</h1>
              <p className="mt-1 text-xs text-ink-subtle">Periode {formatDateShort(report.period.start_date)} sampai {formatDateShort(report.period.end_date)} ({report.period.days} hari)</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total pemasukan" value={formatCurrency(income)} tone="success" />
              <MetricCard label="Total pengeluaran" value={formatCurrency(expense)} tone="danger" />
              <MetricCard label="Net arus kas" value={formatCurrency(summary?.net_cash_flow ?? 0)} tone="primary" />
              <MetricCard label="Total tunggakan" value={formatCurrency(summary?.outstanding_debt ?? 0)} tone="warning" />
            </div>

            <div className="cash-report-screen-only flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-subtle">
                {formatNumber(summary?.transaction_count ?? 0)} transaksi • {formatNumber(summary?.delinquent_students ?? 0)} siswa menunggak • {formatNumber(summary?.debt_record_count ?? 0)} catatan tunggakan
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <ReportFormatSelector
                  name="cash-report-format"
                  value={printFormat}
                  onValueChange={setPrintFormat}
                  className="min-w-40"
                />
                <Button type="button" variant="outline" onClick={onExportCsv} className="min-h-12 border-hairline bg-surface-2 text-xs text-ink-subtle hover:text-ink md:h-8 md:min-h-0">
                  <FileSpreadsheet size={14} className="mr-1.5 text-semantic-success" />
                  Unduh CSV
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)} className="min-h-12 border-hairline bg-surface-2 text-xs text-ink-subtle hover:text-ink md:h-8 md:min-h-0">
                  <Printer size={14} className="mr-1.5" />
                  Pratinjau / Cetak PDF
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Card className="cash-report-page-break-inside-avoid border-hairline bg-surface-1">
              <CardHeader>
                <CardTitle className="text-sm text-ink">Komposisi arus kas</CardTitle>
                <CardDescription className="text-xs text-ink-subtle">Perbandingan pemasukan dan pengeluaran.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
                  <div
                    className="relative h-36 w-36 shrink-0 rounded-full"
                    style={{ background: `conic-gradient(var(--semantic-success) 0 ${incomePercent}%, var(--semantic-danger) ${incomePercent}% 100%)` }}
                    aria-label={`Pemasukan ${incomePercent}% dan pengeluaran ${100 - incomePercent}%`}
                    role="img"
                  >
                    <div className="absolute inset-5 flex items-center justify-center rounded-full bg-surface-1 text-center">
                      <div>
                        <p className="text-lg font-semibold text-ink">{incomePercent}%</p>
                        <p className="text-[10px] text-ink-tertiary">pemasukan</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-full max-w-xs space-y-3">
                    {(report.flow_breakdown ?? []).map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2 text-ink-subtle">
                          <span className={`h-2.5 w-2.5 rounded-full ${row.key === 'income' ? 'bg-semantic-success' : 'bg-semantic-danger'}`} />
                          {row.label}
                        </span>
                        <span className="font-semibold text-ink">{formatCurrency(row.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              </Card>

              <Card className="cash-report-page-break-inside-avoid border-hairline bg-surface-1">
                <CardHeader>
                  <CardTitle className="text-sm text-ink">Kontrol saldo</CardTitle>
                  <CardDescription className="text-xs text-ink-subtle">Saldo awal + net arus kas dibandingkan dengan saldo ledger.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {controlContent}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="cash-report-page space-y-4">
            <Card className="border-hairline bg-surface-1">
              <CardHeader>
                <CardTitle className="text-sm text-ink">Pemasukan berdasarkan metode pembayaran</CardTitle>
                <CardDescription className="text-xs text-ink-subtle">Ringkasan pemasukan non-tagihan pada periode terpilih.</CardDescription>
              </CardHeader>
              <CardContent><BreakdownRows rows={report.payment_method_breakdown ?? []} emptyLabel="Belum ada pemasukan dengan metode pembayaran." labelFormatter={(row) => formatPaymentMethodLabel(row.key, row.label)} /></CardContent>
            </Card>
          </div>

          <div className="cash-report-page space-y-4">
            <Card className="border-hairline bg-surface-1">
              <CardHeader>
                <CardTitle className="text-sm text-ink">Aktivitas harian kas</CardTitle>
                <CardDescription className="text-xs text-ink-subtle">Layar menampilkan hari yang memiliki aktivitas dalam 14 hari terakhir; hasil cetak dan CSV mencakup seluruh {report.period.days} hari.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="cash-report-screen-only">
                  {visibleDaily.length === 0 ? (
                    <p className="py-8 text-center text-xs text-ink-tertiary">Belum ada aktivitas pada 14 hari terakhir.</p>
                  ) : (
                    <div className="space-y-2">
                      {visibleDaily.map((item) => (
                        <DailyBarRow key={item.date} item={item} maxDaily={maxDaily} />
                      ))}
                      <div className="flex gap-4 pt-2 text-[10px] text-ink-tertiary">
                        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-semantic-success" />Masuk</span>
                        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-semantic-danger" />Keluar</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="cash-report-print-only hidden">
                  <CashReportDailyPrintTable rows={activeDaily} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="cash-report-page space-y-4">
            <Card className="border-hairline bg-surface-1">
              <CardHeader>
                <CardTitle className="text-sm text-ink">Siswa yang menunggak</CardTitle>
                <CardDescription className="text-xs text-ink-subtle">Tunggakan belum lunas yang dibuat pada periode laporan, bukan saldo historis sebelum periode.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {debtReportContent}
              </CardContent>
            </Card>
          </div>

          <div className="cash-report-page space-y-4">
            <Card className="border-hairline bg-surface-1">
              <CardHeader><CardTitle className="text-sm text-ink">Rincian detail pemasukan</CardTitle><CardDescription className="text-xs text-ink-subtle">Kategori terbesar dan seluruh transaksi pemasukan pada periode terpilih.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <BreakdownRows rows={report.income_breakdown} emptyLabel="Belum ada pemasukan." />
                {isMobile ? <CashReportDetailMobileList rows={incomeDetails} kind="income" /> : <CashReportDetailTable rows={incomeDetails} kind="income" />}
              </CardContent>
            </Card>
          </div>

          <div className="cash-report-page space-y-4">
            <Card className="border-hairline bg-surface-1">
              <CardHeader><CardTitle className="text-sm text-ink">Rincian detail pengeluaran</CardTitle><CardDescription className="text-xs text-ink-subtle">Kategori dan seluruh transaksi pengeluaran pada periode terpilih.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <BreakdownRows rows={report.expense_breakdown} emptyLabel="Belum ada pengeluaran." />
                {isMobile ? <CashReportDetailMobileList rows={expenseDetails} kind="expense" /> : <CashReportDetailTable rows={expenseDetails} kind="expense" />}
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {report && !rangeError && !isLoading && !error && (
        <ReportPreviewDialog
          dialog={{
            open: isPreviewOpen,
            onOpenChange: setIsPreviewOpen,
          }}
          document={{
            format: printFormat,
            title: "Pratinjau laporan kas",
            description: "Periksa ukuran halaman sebelum mencetak atau menyimpan PDF.",
            pageClass: "cash-report-page",
          }}
          actions={{
            onPrint: handlePrintPreview,
          }}
        >
          <CashReportPreview report={report} activeDaily={activeDaily} />
        </ReportPreviewDialog>
      )}
    </div>
  );
}

function ControlRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2 text-ink-subtle last:border-0">
      <span>{label}</span>
      <span className="font-semibold text-ink">{formatCurrency(value)}</span>
    </div>
  );
}

function DailyBarRow({ item, maxDaily }: { item: CashReportDailyPoint; maxDaily: number }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 text-[10px]">
      <span className="text-ink-tertiary">{formatDateShort(item.date)}</span>
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-semantic-success/80" style={{ width: `${Math.max((item.income / maxDaily) * 100, item.income ? 3 : 0)}%` }} />
        <div className="h-1.5 rounded-full bg-semantic-danger/80" style={{ width: `${Math.max((item.expense / maxDaily) * 100, item.expense ? 3 : 0)}%` }} />
      </div>
      <span className="text-right text-ink-subtle">{formatCurrency(item.income - item.expense)}</span>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' | 'primary' | 'warning' }) {
  const toneClass = {
    success: 'text-semantic-success',
    danger: 'text-semantic-danger',
    primary: 'text-primary',
    warning: 'text-semantic-warning',
  }[tone];

  return (
    <Card className="border-hairline bg-surface-1">
      <CardContent className="pt-4">
        <p className="text-xs text-ink-subtle">{label}</p>
        <p className={`mt-2 text-lg font-semibold tracking-tight ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
