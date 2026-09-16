import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatNumber } from '@/shared/utils/formatNumber';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';

import type { CashReport, CashReportDailyPoint } from '../types/cash.types';
import { CashReportDailyPrintTable } from './CashReportDailyPrintTable';
import { CashReportDebtTable } from './CashReportDebtTable';
import { CashReportDetailTable } from './CashReportDetailTable';

interface CashReportPreviewProps {
  report: CashReport;
  activeDaily: CashReportDailyPoint[];
}

export function CashReportPreview({ report, activeDaily }: CashReportPreviewProps) {
  const { summary } = report;
  const income = summary.total_income;
  const expense = summary.total_expense;
  const totalFlow = income + expense || 1;
  const incomePercent = Math.round((income / totalFlow) * 100);

  return (
    <div className="space-y-4">
      <section className="cash-report-page space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Sinegasi CMS</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Laporan Kas &amp; Tunggakan</h1>
          <p className="mt-1 text-xs text-ink-subtle">
            Periode {formatDateShort(report.period.start_date)} sampai {formatDateShort(report.period.end_date)} ({formatNumber(report.period.days)} hari)
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PreviewMetric label="Total pemasukan" value={income} tone="text-semantic-success" />
          <PreviewMetric label="Total pengeluaran" value={expense} tone="text-semantic-danger" />
          <PreviewMetric label="Net arus kas" value={summary.net_cash_flow} tone="text-primary" />
          <PreviewMetric label="Total tunggakan" value={summary.outstanding_debt} tone="text-semantic-warning" />
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
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-ink-subtle"><span className="h-2.5 w-2.5 rounded-full bg-semantic-success" />Pemasukan</span>
                    <span className="font-semibold text-ink">{formatCurrency(income)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-ink-subtle"><span className="h-2.5 w-2.5 rounded-full bg-semantic-danger" />Pengeluaran</span>
                    <span className="font-semibold text-ink">{formatCurrency(expense)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cash-report-page-break-inside-avoid border-hairline bg-surface-1">
            <CardHeader>
              <CardTitle className="text-sm text-ink">Kontrol saldo</CardTitle>
              <CardDescription className="text-xs text-ink-subtle">Saldo awal dan saldo akhir ledger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {report.control ? (
                <>
                  <PreviewControlRow label="Saldo awal periode" value={report.control.opening_balance} />
                  <PreviewControlRow label="Saldo akhir diharapkan" value={report.control.expected_closing_balance} />
                  <PreviewControlRow label="Saldo akhir ledger" value={report.control.closing_balance} />
                  <PreviewControlRow label="Selisih" value={report.control.difference} />
                </>
              ) : (
                <p className="text-ink-tertiary">Kontrol saldo belum tersedia.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="cash-report-page space-y-4">
        <Card className="border-hairline bg-surface-1">
          <CardHeader>
            <CardTitle className="text-sm text-ink">Pemasukan berdasarkan metode pembayaran</CardTitle>
            <CardDescription className="text-xs text-ink-subtle">Ringkasan pemasukan non-tagihan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(report.payment_method_breakdown ?? []).length === 0 ? (
              <p className="py-6 text-center text-ink-tertiary">Belum ada pemasukan dengan metode pembayaran.</p>
            ) : (
              (report.payment_method_breakdown ?? []).map((row) => (
                <div key={`${row.key}-${row.label}`} className="flex items-center justify-between gap-3 border-b border-hairline pb-2 last:border-0">
                  <span className="text-ink-subtle">{formatPaymentMethodLabel(row.key, row.label)}</span>
                  <span className="font-semibold text-ink">{formatCurrency(row.total)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="cash-report-page space-y-4">
        <Card className="border-hairline bg-surface-1">
          <CardHeader>
            <CardTitle className="text-sm text-ink">Aktivitas harian kas</CardTitle>
            <CardDescription className="text-xs text-ink-subtle">Hanya hari yang memiliki aktivitas.</CardDescription>
          </CardHeader>
          <CardContent>
            <CashReportDailyPrintTable rows={activeDaily} />
          </CardContent>
        </Card>
      </section>

      <section className="cash-report-page space-y-4">
        <Card className="border-hairline bg-surface-1">
          <CardHeader>
            <CardTitle className="text-sm text-ink">Siswa yang menunggak</CardTitle>
            <CardDescription className="text-xs text-ink-subtle">Tunggakan belum lunas pada periode laporan.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {report.debts.length === 0 ? (
              <p className="px-4 pb-5 text-center text-xs text-ink-tertiary">Tidak ada siswa menunggak pada periode ini.</p>
            ) : (
              <CashReportDebtTable debts={report.debts} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="cash-report-page space-y-4">
        <Card className="border-hairline bg-surface-1">
          <CardHeader>
            <CardTitle className="text-sm text-ink">Rincian pemasukan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <CashBreakdownRows rows={report.income_breakdown} emptyLabel="Belum ada pemasukan." />
            <CashReportDetailTable rows={report.income_details ?? []} kind="income" />
          </CardContent>
        </Card>
      </section>

      <section className="cash-report-page space-y-4">
        <Card className="border-hairline bg-surface-1">
          <CardHeader>
            <CardTitle className="text-sm text-ink">Rincian pengeluaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <CashBreakdownRows rows={report.expense_breakdown} emptyLabel="Belum ada pengeluaran." />
            <CashReportDetailTable rows={report.expense_details ?? []} kind="expense" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PreviewMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-2 p-3">
      <p className="text-[10px] text-ink-tertiary">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function PreviewControlRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2 last:border-0">
      <span className="text-ink-subtle">{label}</span>
      <span className="font-semibold text-ink">{formatCurrency(value)}</span>
    </div>
  );
}

function CashBreakdownRows({ rows, emptyLabel }: { rows: CashReport['income_breakdown']; emptyLabel: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-ink-tertiary">{emptyLabel}</p>;

  return (
    <div className="space-y-2 text-xs">
      {rows.slice(0, 8).map((row) => (
        <div key={`${row.key}-${row.label}`} className="flex items-center justify-between gap-3 border-b border-hairline pb-2 last:border-0">
          <span className="text-ink-subtle">{row.label}</span>
          <span className="font-semibold text-ink">{formatCurrency(row.total)}</span>
        </div>
      ))}
    </div>
  );
}
