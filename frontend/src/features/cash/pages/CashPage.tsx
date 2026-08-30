// src/features/cash/pages/CashPage.tsx
// Thin orchestration page for Cash & Debt Management

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Settings } from "lucide-react";

import { PageHeader } from "@/shared/ui/PageHeader";
import { ResponsivePageActions } from "@/shared/ui/ResponsivePageActions";

import { useAuthStore } from "@/features/auth/hooks/useAuthStore";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { toast } from "@/shared/ui/primitives/toast";
import { hasCapability } from "@/shared/auth/capabilities";

import {
  useCashSummaryQuery,
  useCashPaymentMethodsQuery,
  useCashTransactionsQuery,
  useCashDebtsQuery,
  useBillingRulesQuery,
  useCashReportQuery,
  useCashDisputeQuotaQuery,
} from "../hooks/useCashQuery";

import { useCreateCashInMutation } from "../hooks/useCreateCashInMutation";
import { useCreateCashOutMutation } from "../hooks/useCreateCashOutMutation";
import { useCreateDisputeMutation } from "../hooks/useCreateDisputeMutation";
import { useUpdateBillingRulesMutation } from "../hooks/useUpdateBillingRulesMutation";

import { CashBalanceCards } from "../components/CashBalanceCards";
import {
  getDateDaysBefore,
  getInclusiveDays,
  getTodayDate,
  type CashReportPreset,
} from "../utils/reportDates";

import type { CashTransaction, DebtRecord } from "../types/cash.types";
import { CashPageTabs, type CashView } from "../components/CashPageTabs";
import { exportCashReportCsv } from "../utils/exportCashReportCsv";
import { printCashReport } from "../utils/printCashReport";
import { CashPageModals } from "../components/CashPageModals";
import type {
  CashInFormValues,
  CashOutFormValues,
  DisputeFormValues,
  BillingRulesFormValues,
} from "../schemas/cashSchema";


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
  const [disputeDebt, setDisputeDebt] = useState<DebtRecord | null>(null);
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
    isTreasurerOrTeacher && (cashInOpen || isTransactionsView || isReportView);
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
  const { data: disputeQuotaData } = useCashDisputeQuotaQuery(isStudent);
  const disputeQuota = disputeQuotaData?.data;

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
    setDisputeDebt(null);
    setDisputeOpen(true);
  };

  const handleOpenDebtDispute = (debt: DebtRecord) => {
    setDisputeTx(null);
    setDisputeDebt(debt);
    setDisputeOpen(true);
  };

  const handleDisputeSubmit = async (values: DisputeFormValues) => {
    await disputeMutation.mutateAsync({
      payload: values,
      idempotencyKey: crypto.randomUUID(),
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


  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 pt-5 sm:space-y-6 sm:px-6 sm:pt-6 sm:pb-28 md:pb-6">
      <PageHeader
        title={isStudent ? 'Keuangan Kas Saya' : 'Uang Kas & Manajemen Utang'}
        subtitle={isStudent ? 'Pantau pembayaran, tunggakan, dan sanggahan kas Anda.' : 'Pencatatan iuran kas masuk, pengeluaran 2-tahap, saldo tidak boleh negatif, dan sanggahan siswa.'}
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

      {isStudent && disputeQuota && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-ink" role="status">
          <span><strong>Kuota sanggahan bulan {disputeQuota.period}:</strong> {disputeQuota.used}/{disputeQuota.limit} terpakai · {disputeQuota.remaining} tersisa</span>
          <span className="text-xs text-ink-subtle">Reset {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(disputeQuota.resets_at))}</span>
        </div>
      )}

      <CashPageTabs
        currentView={currentView}
        isTreasurerOrTeacher={isTreasurerOrTeacher}
        isStudent={isStudent}
        isMobile={isMobile}
        pageSize={pageSize}
        paymentMethods={paymentMethods}
        isPaymentMethodsLoading={isPaymentMethodsLoading}
        txData={txData}
        isTxLoading={isTxLoading}
        txError={txError}
        txPage={txPage}
        onRetryTransactions={() => void refetchTransactions()}
        setTxPage={setTxPage}
        tanggalMulai={tanggalMulai}
        tanggalSelesai={tanggalSelesai}
        metodePembayaran={metodePembayaran}
        setTanggalMulai={setTanggalMulai}
        setTanggalSelesai={setTanggalSelesai}
        setMetodePembayaran={setMetodePembayaran}
        debtsData={debtsData}
        isDebtsLoading={isDebtsLoading}
        debtsError={debtsError}
        debtsPage={debtsPage}
        onRetryDebts={() => void refetchDebts()}
        setDebtsPage={setDebtsPage}
        disputeQuota={disputeQuota}
        outstandingDebt={summaryData?.totalTunggakanSiswa ?? 0}
        reportData={reportData}
        isReportLoading={isReportLoading}
        reportError={reportError}
        reportRangeError={reportRangeError}
        reportStartDate={reportStartDate}
        reportEndDate={reportEndDate}
        reportPaymentMethod={reportPaymentMethod}
        setReportStartDate={setReportStartDate}
        setReportEndDate={setReportEndDate}
        setReportPaymentMethod={setReportPaymentMethod}
        handleReportPreset={handleReportPreset}
        onExportCsv={exportCashReportCsv}
        onPrintReport={printCashReport}
        onDisputeTransaction={handleOpenDispute}
        onDisputeDebt={handleOpenDebtDispute}
        setActiveView={setActiveView}
      />

      <CashPageModals
        isTreasurerOrTeacher={isTreasurerOrTeacher}
        isStudent={isStudent}
        cashInOpen={cashInOpen}
        setCashInOpen={setCashInOpen}
        handleCashInSubmit={handleCashInSubmit}
        cashInLoading={cashInMutation.isPending}
        cashInError={cashInMutation.error}
        paymentMethodsError={paymentMethodsError}
        paymentMethods={paymentMethods}
        isPaymentMethodsLoading={isPaymentMethodsLoading}
        cashOutOpen={cashOutOpen}
        setCashOutOpen={setCashOutOpen}
        currentBalance={summaryData?.saldoUtama ?? 0}
        handleCashOutSubmit={handleCashOutSubmit}
        cashOutLoading={cashOutMutation.isPending}
        cashOutError={cashOutMutation.error}
        rulesOpen={rulesOpen}
        setRulesOpen={setRulesOpen}
        billingRules={rulesData}
        handleBillingRulesSubmit={handleBillingRulesSubmit}
        billingRulesLoading={billingRulesMutation.isPending}
        billingRulesError={billingRulesMutation.error}
        disputeOpen={disputeOpen}
        setDisputeOpen={setDisputeOpen}
        disputeTx={disputeTx}
        disputeDebt={disputeDebt}
        handleDisputeSubmit={handleDisputeSubmit}
        disputeLoading={disputeMutation.isPending}
        disputeError={disputeMutation.error}
        disputeQuota={disputeQuota}
      />
    </div>
  );
}