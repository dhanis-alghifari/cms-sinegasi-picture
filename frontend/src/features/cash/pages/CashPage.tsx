
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/shared/ui/PageHeader";

import { useAuthStore } from "@/features/auth/hooks/useAuthStore";
import { useStudentOptionsQuery } from "@/features/students/hooks/useStudentOptionsQuery";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { UI_CONSTANTS } from "@/shared/constants/ui";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { formatNumber } from "@/shared/utils/formatNumber";
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

import type { StudentOption } from "@/features/students/types/students.types";
import type { CashScope, CashTransaction, DebtRecord } from "../types/cash.types";
import { CashPageTabs, type CashView } from "../components/CashPageTabs";
import { CashPageActions } from "../components/CashPageActions";
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
  const canManageCash = hasCapability(user, "cash.manage");
  const canReadOwnCash = hasCapability(user, "cash.read.own");
  const canSubmitDispute = hasCapability(user, "cash.dispute.create");
  const canReviewCashDisputes = user?.role === "teacher" && hasCapability(user, "cash.dispute.review");
  const canReadOwnCashDisputes = hasCapability(user, "cash.dispute.read.own");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedOwnScope = searchParams.get("scope") === "own";
  const cashScope: CashScope = canManageCash && !(requestedOwnScope && canReadOwnCash) ? "manage" : "own";
  const isOwnScope = cashScope === "own";
  const isTreasurerOrTeacher = canManageCash && !isOwnScope;
  const isStudent = isOwnScope;

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
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [reportPaymentMethod, setReportPaymentMethod] = useState("");
  const [reportStartDate, setReportStartDate] = useState(() =>
    getDateDaysBefore(getTodayDate(), 29),
  );
  const [reportEndDate, setReportEndDate] = useState(getTodayDate);
  const [activeView, setActiveView] = useState<CashView>("activity");
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;
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
    if (days > UI_CONSTANTS.MAX_CASH_REPORT_RANGE_DAYS) {
      return `Rentang laporan maksimal ${UI_CONSTANTS.MAX_CASH_REPORT_RANGE_DAYS} hari.`;
    }
    return undefined;
  }, [reportEndDate, reportStartDate]);

  // Queries
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useCashSummaryQuery(cashScope);
  const shouldLoadPaymentMethods =
    isTreasurerOrTeacher && (cashInOpen || isTransactionsView || isReportView);
  const shouldLoadStudentOptions = isTreasurerOrTeacher && (isTransactionsView || isDebtsView);
  const {
    data: paymentMethodsData,
    isLoading: isPaymentMethodsLoading,
    error: paymentMethodsError,
  } = useCashPaymentMethodsQuery(shouldLoadPaymentMethods);
  const paymentMethods = paymentMethodsData?.data ?? [];
  const studentOptionsQuery = useStudentOptionsQuery(studentSearch, shouldLoadStudentOptions);
  const {
    data: txData,
    isLoading: isTxLoading,
    error: txError,
    refetch: refetchTransactions,
  } = useCashTransactionsQuery(
    {
      page: txPage,
      pageSize: isActivityView ? 5 : pageSize,
      scope: cashScope,
      tanggal_mulai: tanggalMulai || undefined,
      tanggal_selesai: tanggalSelesai || undefined,
      metode_pembayaran: metodePembayaran || undefined,
      student_id: isTransactionsView ? selectedStudent?.id : undefined,
    },
    isActivityView || isTransactionsView,
  );
  const {
    data: debtsData,
    isLoading: isDebtsLoading,
    error: debtsError,
    refetch: refetchDebts,
  } = useCashDebtsQuery({
    page: debtsPage,
    pageSize,
    scope: cashScope,
    student_id: isDebtsView ? selectedStudent?.id : undefined,
  }, isDebtsView);
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
  const { data: disputeQuotaData } = useCashDisputeQuotaQuery(isOwnScope && canSubmitDispute);
  const disputeQuota = disputeQuotaData?.data;

  // Mutations
  const cashInMutation = useCreateCashInMutation();
  const cashOutMutation = useCreateCashOutMutation();
  const disputeMutation = useCreateDisputeMutation();
  const billingRulesMutation = useUpdateBillingRulesMutation();

  // Handlers
  const handleRetrySummary = () => {
    void refetchSummary();
  };

  const handleRetryTransactions = () => {
    void refetchTransactions();
  };

  const handleRetryStudentOptions = () => {
    void studentOptionsQuery.refetch();
  };

  const handleRetryDebts = () => {
    void refetchDebts();
  };

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
    toast.add({
      type: "success",
      title: "Sanggahan terkirim",
      description: "Status diubah menjadi menunggu pemeriksaan guru. Pengajuan yang sama tidak dapat dikirim ulang selama masih diperiksa.",
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

  const resetStudentScope = () => {
    setStudentSearch("");
    setSelectedStudent(null);
    setTxPage(1);
    setDebtsPage(1);
  };

  const handleStudentScopeValueChange = (studentId: string) => {
    if (!studentId) setSelectedStudent(null);
    setTxPage(1);
    setDebtsPage(1);
  };

  const handleSelectedStudentScopeChange = (student: StudentOption | null) => {
    setSelectedStudent(student);
    setTxPage(1);
    setDebtsPage(1);
  };

  const resetTransactionFilters = () => {
    setTanggalMulai("");
    setTanggalSelesai("");
    setMetodePembayaran("");
    resetStudentScope();
  };

  const handleScopeChange = (scope: CashScope) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("scope", scope);
      return next;
    });
    setActiveView(scope === "own" ? "transactions" : "activity");
    resetStudentScope();
  };


  return (
    <div className="space-y-5 px-4 pb-28 pt-5 sm:space-y-6 sm:px-6 sm:pt-6 sm:pb-28 md:pb-6">
      <PageHeader
        title={isStudent ? 'Keuangan Kas Saya' : 'Uang Kas & Manajemen Utang'}
        subtitle={isStudent ? 'Pantau pembayaran, tunggakan, dan sanggahan kas Anda.' : 'Pencatatan iuran kas masuk, pengeluaran 2-tahap, saldo tidak boleh negatif, dan sanggahan siswa.'}
        actions={
          <CashPageActions
            canManageCash={canManageCash}
            canReadOwnCash={canReadOwnCash}
            isOwnScope={isOwnScope}
            isTreasurerOrTeacher={isTreasurerOrTeacher}
            onScopeChange={handleScopeChange}
            onCashIn={() => setCashInOpen(true)}
            onCashOut={() => setCashOutOpen(true)}
            onBillingRules={() => setRulesOpen(true)}
          />
        }
      />

      <CashBalanceCards
        summary={summaryData}
        isStudent={isStudent}
        isLoading={isSummaryLoading}
        error={summaryError}
        onRetry={handleRetrySummary}
      />

      {isStudent && canSubmitDispute && disputeQuota && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-ink" role="status">
          <span><strong>Kuota sanggahan bulan {disputeQuota.period}:</strong> {formatNumber(disputeQuota.used)}/{formatNumber(disputeQuota.limit)} terpakai · {formatNumber(disputeQuota.remaining)} tersisa</span>
          <span className="text-xs text-ink-subtle">Reset {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(disputeQuota.resets_at))}</span>
        </div>
      )}

      <CashPageTabs
        navigation={{
          currentView,
          isTreasurerOrTeacher,
          isStudent,
          canReviewDisputes: canReviewCashDisputes,
          canReadOwnDisputes: canReadOwnCashDisputes,
          isMobile,
          pageSize,
          onChange: setActiveView,
        }}
        paymentMethods={{ items: paymentMethods, isLoading: isPaymentMethodsLoading }}
        transactions={{
          data: txData,
          isLoading: isTxLoading,
          error: txError,
          page: txPage,
          onRetry: handleRetryTransactions,
          onPageChange: setTxPage,
        }}
        transactionFilters={{
          startDate: tanggalMulai,
          endDate: tanggalSelesai,
          paymentMethod: metodePembayaran,
          onStartDateChange: setTanggalMulai,
          onEndDateChange: setTanggalSelesai,
          onPaymentMethodChange: setMetodePembayaran,
          onReset: resetTransactionFilters,
        }}
        studentScope={{
          canFilter: isTreasurerOrTeacher,
          selectedStudent,
          options: studentOptionsQuery.data?.data ?? [],
          isLoading: studentOptionsQuery.isFetching,
          error: studentOptionsQuery.error,
          onValueChange: handleStudentScopeValueChange,
          onSelectedStudentChange: handleSelectedStudentScopeChange,
          onSearchChange: setStudentSearch,
          onClear: resetStudentScope,
          onRetry: handleRetryStudentOptions,
        }}
        debts={{
          data: debtsData,
          isLoading: isDebtsLoading,
          error: debtsError,
          page: debtsPage,
          onRetry: handleRetryDebts,
          onPageChange: setDebtsPage,
          outstandingAmount: summaryData?.totalTunggakanSiswa ?? 0,
        }}
        report={{
          data: reportData,
          isLoading: isReportLoading,
          error: reportError,
          rangeError: reportRangeError,
          startDate: reportStartDate,
          endDate: reportEndDate,
          paymentMethod: reportPaymentMethod,
          onStartDateChange: setReportStartDate,
          onEndDateChange: setReportEndDate,
          onPaymentMethodChange: setReportPaymentMethod,
          onPreset: handleReportPreset,
          onExportCsv: exportCashReportCsv,
          onPrintPdf: printCashReport,
        }}
        actions={{
          onDisputeTransaction: handleOpenDispute,
          onDisputeDebt: handleOpenDebtDispute,
          disputeQuota,
        }}
      />

      <CashPageModals
        access={{ isTreasurerOrTeacher, isStudent: isStudent && canSubmitDispute }}
        cashIn={{
          open: cashInOpen, onOpenChange: setCashInOpen, onSubmit: handleCashInSubmit,
          isLoading: cashInMutation.isPending, error: cashInMutation.error, paymentMethodsError, paymentMethods,
          isPaymentMethodsLoading, nominalIuranWajib: rulesData?.nominal_iuran_wajib ?? 5000,
        }}
        cashOut={{
          open: cashOutOpen, onOpenChange: setCashOutOpen, currentBalance: summaryData?.saldoUtama ?? 0,
          onSubmit: handleCashOutSubmit, isLoading: cashOutMutation.isPending, error: cashOutMutation.error,
        }}
        billingRules={{
          open: rulesOpen, onOpenChange: setRulesOpen, billingRules: rulesData,
          onSubmit: handleBillingRulesSubmit, isLoading: billingRulesMutation.isPending, error: billingRulesMutation.error,
        }}
        dispute={{
          open: disputeOpen, onOpenChange: setDisputeOpen, transaction: disputeTx, debt: disputeDebt,
          onSubmit: handleDisputeSubmit, isLoading: disputeMutation.isPending, error: disputeMutation.error, quota: disputeQuota,
        }}
      />
    </div>
  );
}
