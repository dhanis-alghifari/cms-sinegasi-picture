// src/features/cash/pages/CashPage.tsx
// Thin orchestration page for Cash & Debt Management

import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Settings } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ResponsivePageActions } from "@/components/common/ResponsivePageActions";
import { Pagination } from "@/components/common/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuthStore } from "@/features/auth/hooks/useAuthStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { formatPaymentMethodLabel } from "@/shared/utils/formatLabels";
import { toast } from "@/components/ui/toast";
import { hasCapability } from "@/shared/auth/capabilities";

import {
  useCashSummaryQuery,
  useCashPaymentMethodsQuery,
  useCashTransactionsQuery,
  useCashDebtsQuery,
  useBillingRulesQuery,
  useCashReportQuery,
} from "../queries/useCashQuery";

import { useCreateCashInMutation } from "../mutations/useCreateCashInMutation";
import { useCreateCashOutMutation } from "../mutations/useCreateCashOutMutation";
import { useCreateDisputeMutation } from "../mutations/useCreateDisputeMutation";
import { useUpdateBillingRulesMutation } from "../mutations/useUpdateBillingRulesMutation";

import { CashBalanceCards } from "../components/CashBalanceCards";
import { CashOperationsOverview } from "../components/CashOperationsOverview";
import {
  CashSectionError,
  CashSectionSkeleton,
} from "../components/CashSectionState";
import { CashTransactionTable } from "../components/CashTransactionTable";
import { CashTransactionMobileList } from "../components/CashTransactionMobileList";
import { DebtRecordsTable } from "../components/DebtRecordsTable";
import { DebtRecordsMobileList } from "../components/DebtRecordsMobileList";
import {
  getDateDaysBefore,
  getInclusiveDays,
  getTodayDate,
  type CashReportPreset,
} from "../utils/reportDates";

import type { CashReport, CashTransaction } from "../types/cash.types";
import type {
  CashInFormValues,
  CashOutFormValues,
  DisputeFormValues,
  BillingRulesFormValues,
} from "../schemas/cashSchema";

type CashView = "activity" | "transactions" | "debts" | "report";

const LazyFastCashInModal = lazy(() =>
  import("../components/FastCashInModal").then(({ FastCashInModal }) => ({
    default: FastCashInModal,
  })),
);
const LazyTwoStageCashOutModal = lazy(() =>
  import("../components/TwoStageCashOutModal").then(
    ({ TwoStageCashOutModal }) => ({ default: TwoStageCashOutModal }),
  ),
);
const LazyBillingRulesModal = lazy(() =>
  import("../components/BillingRulesModal").then(({ BillingRulesModal }) => ({
    default: BillingRulesModal,
  })),
);
const LazyStudentDisputeModal = lazy(() =>
  import("../components/StudentDisputeModal").then(
    ({ StudentDisputeModal }) => ({ default: StudentDisputeModal }),
  ),
);
const LazyCashReportPanel = lazy(() =>
  import("../components/CashReportPanel").then(({ CashReportPanel }) => ({
    default: CashReportPanel,
  })),
);

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function exportCashReportCsv(report: CashReport): void {
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
      control
        ? control.is_balanced
          ? "Seimbang"
          : "Perlu pemeriksaan"
        : "Belum tersedia",
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
    ...report.daily.map((item) => [item.date, item.income, item.expense]),
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

export function CashPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const isTreasurerOrTeacher = hasCapability(user, "cash.manage");
  const isStudent = user?.role === "member";

  // Modals state
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeTx, setDisputeTx] = useState<CashTransaction | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Pagination state
  const [txPage, setTxPage] = useState(1);
  const [debtsPage, setDebtsPage] = useState(1);
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [metodePembayaran, setMetodePembayaran] = useState("");
  const [reportPaymentMethod, setReportPaymentMethod] = useState("");
  const [reportStartDate, setReportStartDate] = useState(() =>
    getDateDaysBefore(getTodayDate(), 29),
  );
  const [reportEndDate, setReportEndDate] = useState(getTodayDate);
  const [activeView, setActiveView] = useState<CashView>("activity");
  const pageSize = 10;
  const currentView: CashView =
    isStudent && activeView === "activity" ? "transactions" : activeView;
  const isActivityView = currentView === "activity";
  const isTransactionsView = currentView === "transactions";
  const isDebtsView = currentView === "debts";
  const isReportView = currentView === "report";

  const reportRangeError = useMemo(() => {
    const days = getInclusiveDays(reportStartDate, reportEndDate);
    if (days <= 0)
      return "Tanggal mulai harus sama atau sebelum tanggal selesai.";
    if (days > 90) return "Rentang laporan maksimal 90 hari.";
    return undefined;
  }, [reportEndDate, reportStartDate]);

  // Queries
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useCashSummaryQuery();
  const shouldLoadPaymentMethods =
    cashInOpen || isTransactionsView || isReportView;
  const {
    data: paymentMethodsData,
    isLoading: isPaymentMethodsLoading,
    error: paymentMethodsError,
  } = useCashPaymentMethodsQuery(shouldLoadPaymentMethods);
  const paymentMethods = paymentMethodsData?.data ?? [];
  const {
    data: txData,
    isLoading: isTxLoading,
    error: txError,
    refetch: refetchTransactions,
  } = useCashTransactionsQuery(
    {
      page: txPage,
      pageSize: isActivityView ? 5 : pageSize,
      tanggal_mulai: tanggalMulai || undefined,
      tanggal_selesai: tanggalSelesai || undefined,
      metode_pembayaran: metodePembayaran || undefined,
    },
    isActivityView || isTransactionsView,
  );
  const {
    data: debtsData,
    isLoading: isDebtsLoading,
    error: debtsError,
    refetch: refetchDebts,
  } = useCashDebtsQuery({ page: debtsPage, pageSize }, isDebtsView);
  const {
    data: reportData,
    isLoading: isReportLoading,
    error: reportError,
  } = useCashReportQuery(
    {
      start_date: reportStartDate,
      end_date: reportEndDate,
      metode_pembayaran: reportPaymentMethod || undefined,
    },
    isTreasurerOrTeacher && isReportView && !reportRangeError,
  );
  const { data: rulesData } = useBillingRulesQuery(cashInOpen || rulesOpen);

  // Mutations
  const cashInMutation = useCreateCashInMutation();
  const cashOutMutation = useCreateCashOutMutation();
  const disputeMutation = useCreateDisputeMutation();
  const billingRulesMutation = useUpdateBillingRulesMutation();

  // Handlers
  const handleCashInSubmit = async (values: CashInFormValues) => {
    const optimisticPaymentMethodLabel = paymentMethods.find(
      (method) => method.code === values.metode_pembayaran,
    )?.label;
    const response = await cashInMutation.mutateAsync({
      payload: {
        type: values.type,
        student_id:
          values.type === "iuran_wajib" ? values.student_id : undefined,
        tanggal: values.tanggal,
        jumlah: values.jumlah,
        keterangan: values.keterangan,
        foto_bukti_url: values.foto_bukti_url || undefined,
        metode_pembayaran: values.metode_pembayaran,
      },
      idempotencyKey: crypto.randomUUID(),
      optimisticPaymentMethodLabel,
    });
    if (response.result.payment_status === "unpaid") {
      toast.add({
        type: "success",
        title: "Tunggakan tercatat",
        description: `Tunggakan ${formatCurrency(response.result.amount_outstanding)} berhasil dicatat untuk siswa tersebut.`,
      });
    } else if (response.result.payment_status === "partial") {
      toast.add({
        type: "success",
        title: "Pembayaran tercatat",
        description: `Pembayaran masuk dan tunggakan tersisa ${formatCurrency(response.result.amount_outstanding)}.`,
      });
    }
  };

  const handleCashOutSubmit = async (values: CashOutFormValues) => {
    await cashOutMutation.mutateAsync({
      payload: {
        jumlah: values.jumlah,
        keterangan: values.keterangan,
        foto_bukti_url: values.foto_bukti_url || undefined,
      },
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleOpenDispute = (tx: CashTransaction) => {
    setDisputeTx(tx);
    setDisputeOpen(true);
  };

  const handleDisputeSubmit = async (values: DisputeFormValues) => {
    const { ...payload } = values;
    await disputeMutation.mutateAsync({
      payload: { ...payload, student_id: disputeTx?.student_id },
    });
  };

  const handleBillingRulesSubmit = async (values: BillingRulesFormValues) => {
    const { change_reason, ...payload } = values;
    await billingRulesMutation.mutateAsync({
      payload,
      changeReason: change_reason,
    });
  };

  const handleReportPreset = (days: CashReportPreset) => {
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(reportEndDate)
      ? reportEndDate
      : getTodayDate();
    setReportEndDate(endDate);
    setReportStartDate(getDateDaysBefore(endDate, days - 1));
  };

  const handlePrintReport = () => {
    const style = document.createElement("style");
    style.textContent = `
      @page { size: A4 portrait; margin: 12mm; }
      @media print {
        html, body { background: #fff !important; }
        body * { visibility: hidden !important; }
        #cash-report-print, #cash-report-print * { visibility: visible !important; }
        #cash-report-print {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          background: #fff !important;
          color: #000 !important;
          font-size: 10pt !important;
        }
        #cash-report-print * { color: #000 !important; }
        #cash-report-print .cash-report-screen-only { display: none !important; }
        #cash-report-print .bg-surface-1,
        #cash-report-print .bg-surface-2,
        #cash-report-print [class~="bg-surface-2/60"] { background: #fff !important; }
        #cash-report-print .cash-report-scroll { max-height: none !important; overflow: visible !important; }
        #cash-report-print .cash-report-page {
          break-after: page;
          page-break-after: always;
          min-height: calc(297mm - 24mm);
          box-sizing: border-box;
        }
        #cash-report-print .cash-report-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }
        #cash-report-print .cash-report-print-only { display: block !important; }
        #cash-report-print table { width: 100% !important; border-collapse: collapse !important; }
        #cash-report-print th, #cash-report-print td {
          border-bottom: 1px solid #d1d5db !important;
          color: #000 !important;
          padding: 5px !important;
        }
        #cash-report-print .cash-report-page-break-inside-avoid { break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    const cleanup = () => style.remove();
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 pt-5 sm:space-y-6 sm:px-6 sm:pt-6 sm:pb-28 md:pb-6">
      <PageHeader
        title="Uang Kas & Manajemen Utang"
        subtitle="Pencatatan iuran kas masuk, pengeluaran 2-tahap, saldo tidak boleh negatif, dan sanggahan siswa."
        actions={
          isTreasurerOrTeacher ? (
            <ResponsivePageActions
              mobileLabel="Tindakan Kas"
              mobileDescription="Pilih aktivitas kas yang ingin dicatat."
              actions={[
                {
                  id: "cash-in",
                  label: "Kas Masuk",
                  description: "Catat iuran siswa atau pemasukan lain.",
                  icon: ArrowDownRight,
                  className:
                    "bg-semantic-success text-white hover:bg-semantic-success/80",
                  onSelect: () => setCashInOpen(true),
                },
                {
                  id: "cash-out",
                  label: "Pengeluaran",
                  description: "Catat pengeluaran dengan kontrol saldo.",
                  icon: ArrowUpRight,
                  className:
                    "bg-semantic-danger text-white hover:bg-semantic-danger/80",
                  onSelect: () => setCashOutOpen(true),
                },
                {
                  id: "billing-rules",
                  label: "Pengaturan Iuran",
                  description: "Atur nominal iuran dan periode libur.",
                  icon: Settings,
                  variant: "outline",
                  className: "bg-surface-1 text-ink-subtle hover:text-ink",
                  onSelect: () => setRulesOpen(true),
                },
              ]}
            />
          ) : undefined
        }
      />

      <CashBalanceCards
        summary={summaryData}
        isStudent={isStudent}
        isLoading={isSummaryLoading}
        error={summaryError}
        onRetry={() => {
          void refetchSummary();
        }}
      />

      {/* Tabs Layout */}
      <Tabs
        value={currentView}
        onValueChange={(value) => setActiveView(value as CashView)}
        className="w-full"
      >
        <TabsList
          className={`grid min-h-14 w-full gap-1 bg-surface-1 p-2 md:flex md:h-auto md:min-h-0 md:w-fit md:gap-2 md:p-1 ${isTreasurerOrTeacher ? "grid-cols-4" : "grid-cols-2"}`}
        >
          {isTreasurerOrTeacher && (
            <TabsTrigger
              value="activity"
              className="min-h-12 min-w-0 flex-1 px-1 text-xs leading-tight md:min-h-9 md:min-w-36 md:flex-none md:whitespace-nowrap md:px-3 data-[state=active]:bg-surface-2 data-[state=active]:text-ink"
            >
              <span className="md:hidden">Aktivitas</span>
              <span className="hidden md:inline">Aktivitas Kas</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="transactions"
            className="min-h-12 min-w-0 flex-1 px-1 text-xs leading-tight md:min-h-9 md:min-w-40 md:flex-none md:whitespace-nowrap md:px-3 data-[state=active]:bg-surface-2 data-[state=active]:text-ink"
          >
            <span className="md:hidden">Transaksi</span>
            <span className="hidden md:inline">Riwayat Transaksi Kas</span>
          </TabsTrigger>
          <TabsTrigger
            value="debts"
            className="min-h-12 min-w-0 flex-1 px-1 text-xs leading-tight md:min-h-9 md:min-w-40 md:flex-none md:whitespace-nowrap md:px-3 data-[state=active]:bg-surface-2 data-[state=active]:text-ink"
          >
            <span className="md:hidden">Tunggakan</span>
            <span className="hidden md:inline">Daftar Tunggakan Siswa</span>
          </TabsTrigger>
          {isTreasurerOrTeacher && (
            <TabsTrigger
              value="report"
              className="min-h-12 min-w-0 flex-1 px-1 text-xs leading-tight md:min-h-9 md:min-w-36 md:flex-none md:whitespace-nowrap md:px-3 data-[state=active]:bg-surface-2 data-[state=active]:text-ink"
            >
              <span className="md:hidden">Laporan</span>
              <span className="hidden md:inline">Laporan Kas</span>
            </TabsTrigger>
          )}
        </TabsList>

        {isTreasurerOrTeacher && isActivityView && (
          <TabsContent value="activity" className="mt-4">
            <CashOperationsOverview
              transactions={txData?.data ?? []}
              isLoading={isTxLoading}
              error={txError}
              isMobile={isMobile}
              isStudent={isStudent}
              outstandingDebt={summaryData?.totalTunggakanSiswa ?? 0}
              onDispute={handleOpenDispute}
              onRetry={() => {
                void refetchTransactions();
              }}
              onViewTransactions={() => setActiveView("transactions")}
              onViewDebts={() => setActiveView("debts")}
            />
          </TabsContent>
        )}

        {isTreasurerOrTeacher && isReportView && (
          <TabsContent value="report" className="mt-4">
            <Suspense fallback={<CashSectionSkeleton rows={2} />}>
              <LazyCashReportPanel
                report={reportData}
                isLoading={isReportLoading}
                error={reportError}
                startDate={reportStartDate}
                endDate={reportEndDate}
                paymentMethodCode={reportPaymentMethod}
                paymentMethods={paymentMethods}
                isPaymentMethodsLoading={isPaymentMethodsLoading}
                rangeError={reportRangeError}
                onStartDateChange={setReportStartDate}
                onEndDateChange={setReportEndDate}
                onPaymentMethodChange={setReportPaymentMethod}
                onPreset={handleReportPreset}
                onReset={() => {
                  handleReportPreset(30);
                  setReportPaymentMethod("");
                }}
                onExportCsv={() => {
                  if (reportData) exportCashReportCsv(reportData);
                }}
                onPrintPdf={handlePrintReport}
              />
            </Suspense>
          </TabsContent>
        )}

        {isTransactionsView && (
          <TabsContent value="transactions" className="mt-4">
            <div className="mb-4 grid gap-2 rounded-xl border border-hairline bg-surface-1 p-3 md:flex md:flex-wrap md:items-center">
              <Input
                type="date"
                aria-label="Tanggal mulai transaksi"
                value={tanggalMulai}
                onChange={(event) => {
                  setTanggalMulai(event.target.value);
                  setTxPage(1);
                }}
                className="min-h-12 text-xs text-ink md:min-h-0 md:w-44"
              />
              <Input
                type="date"
                aria-label="Tanggal selesai transaksi"
                value={tanggalSelesai}
                min={tanggalMulai || undefined}
                onChange={(event) => {
                  setTanggalSelesai(event.target.value);
                  setTxPage(1);
                }}
                className="min-h-12 text-xs text-ink md:min-h-0 md:w-44"
              />
              <Select
                value={metodePembayaran || "all"}
                onValueChange={(value) => {
                  setMetodePembayaran(value === "all" || !value ? "" : value);
                  setTxPage(1);
                }}
              >
                <SelectTrigger
                  className="min-h-12 text-xs text-ink md:min-h-0 md:w-48"
                  aria-label="Filter metode pembayaran"
                >
                  <SelectValue placeholder="Semua metode" />
                </SelectTrigger>
                <SelectContent className="border-hairline bg-surface-3 text-ink">
                  <SelectItem value="all">Semua metode</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.code}>
                      {formatPaymentMethodLabel(method.code, method.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(tanggalMulai || tanggalSelesai || metodePembayaran) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTanggalMulai("");
                    setTanggalSelesai("");
                    setMetodePembayaran("");
                    setTxPage(1);
                  }}
                  className="min-h-12 text-xs text-ink-subtle"
                >
                  Reset periode
                </Button>
              )}
            </div>
            {isTxLoading ? (
              <CashSectionSkeleton rows={4} />
            ) : txError ? (
              <CashSectionError
                error={txError}
                title="Riwayat transaksi belum dapat dimuat"
                onRetry={() => {
                  void refetchTransactions();
                }}
              />
            ) : (
              <div className="space-y-4">
                {isMobile ? (
                  <CashTransactionMobileList
                    transactions={txData?.data ?? []}
                    onDispute={handleOpenDispute}
                    isStudent={isStudent}
                  />
                ) : (
                  <CashTransactionTable
                    transactions={txData?.data ?? []}
                    onDispute={handleOpenDispute}
                    isStudent={isStudent}
                  />
                )}
                <Pagination
                  page={txData?.page ?? txPage}
                  totalPages={txData?.totalPages ?? 1}
                  total={txData?.total ?? 0}
                  pageSize={txData?.pageSize ?? pageSize}
                  onPageChange={setTxPage}
                />
              </div>
            )}
          </TabsContent>
        )}

        {isDebtsView && (
          <TabsContent value="debts" className="mt-4">
            {isDebtsLoading ? (
              <CashSectionSkeleton rows={4} />
            ) : debtsError ? (
              <CashSectionError
                error={debtsError}
                title="Daftar tunggakan belum dapat dimuat"
                onRetry={() => {
                  void refetchDebts();
                }}
              />
            ) : (
              <div className="space-y-4">
                {isMobile ? (
                  <DebtRecordsMobileList debts={debtsData?.data ?? []} />
                ) : (
                  <DebtRecordsTable debts={debtsData?.data ?? []} />
                )}
                <Pagination
                  page={debtsData?.page ?? debtsPage}
                  totalPages={debtsData?.totalPages ?? 1}
                  total={debtsData?.total ?? 0}
                  pageSize={debtsData?.pageSize ?? pageSize}
                  onPageChange={setDebtsPage}
                />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Modals */}
      <Suspense fallback={null}>
        {isTreasurerOrTeacher && cashInOpen && (
          <LazyFastCashInModal
            open={cashInOpen}
            onOpenChange={setCashInOpen}
            onSubmit={handleCashInSubmit}
            isLoading={cashInMutation.isPending}
            error={cashInMutation.error}
            paymentMethodsError={paymentMethodsError}
            nominalIuranWajib={rulesData?.nominal_iuran_wajib ?? 5000}
            paymentMethods={paymentMethods}
            isPaymentMethodsLoading={isPaymentMethodsLoading}
          />
        )}

        {isTreasurerOrTeacher && cashOutOpen && (
          <LazyTwoStageCashOutModal
            open={cashOutOpen}
            onOpenChange={setCashOutOpen}
            currentBalance={summaryData?.saldoUtama ?? 0}
            onSubmit={handleCashOutSubmit}
            isLoading={cashOutMutation.isPending}
            error={cashOutMutation.error}
          />
        )}

        {isTreasurerOrTeacher && rulesOpen && (
          <LazyBillingRulesModal
            open={rulesOpen}
            onOpenChange={setRulesOpen}
            billingRules={rulesData}
            onSubmit={handleBillingRulesSubmit}
            isLoading={billingRulesMutation.isPending}
            error={billingRulesMutation.error}
          />
        )}

        {isStudent && disputeOpen && (
          <LazyStudentDisputeModal
            open={disputeOpen}
            onOpenChange={setDisputeOpen}
            transaction={disputeTx}
            onSubmit={handleDisputeSubmit}
            isLoading={disputeMutation.isPending}
            error={disputeMutation.error}
          />
        )}
      </Suspense>
    </div>
  );
}
