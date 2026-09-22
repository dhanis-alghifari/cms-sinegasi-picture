
import { lazy, Suspense } from 'react';

import { Pagination } from '@/shared/ui/Pagination';
import { AnimatedTabs } from '@/shared/ui/motion/animated-tabs';
import { PanelSkeleton } from '@/shared/ui/LoadingSkeletons';
import type { ReportPrintFormat } from '@/shared/types/report';
import type { PaginatedResponse } from '@/shared/types/common';
import type { StudentOption } from '@/features/students/types/students.types';

import { CashOperationsOverview } from './CashOperationsOverview';
import { CashSectionError, CashSectionSkeleton } from './CashSectionState';
import { CashTransactionTable } from './CashTransactionTable';
import { CashTransactionMobileList } from './CashTransactionMobileList';
import { DebtRecordsTable } from './DebtRecordsTable';
import { DebtRecordsMobileList } from './DebtRecordsMobileList';
import { CashDisputeQueue } from './CashDisputeQueue';
import type {
  CashDisputeQuota,
  CashPaymentMethod,
  CashReport,
  CashTransaction,
  DebtRecord,
} from '../types/cash.types';
import type { CashReportPreset } from '../utils/reportDates';

export type CashView = 'activity' | 'transactions' | 'debts' | 'disputes' | 'report';

function isCashView(value: string): value is CashView {
  return ['activity', 'transactions', 'debts', 'disputes', 'report'].includes(value);
}

type CashPageTabsProps = {
  navigation: {
    currentView: CashView;
    isTreasurerOrTeacher: boolean;
    isStudent: boolean;
    isMobile: boolean;
    pageSize: number;
    onChange: (view: CashView) => void;
  };
  paymentMethods: {
    items: CashPaymentMethod[];
    isLoading: boolean;
  };
  transactions: {
    data?: PaginatedResponse<CashTransaction>;
    isLoading: boolean;
    error?: unknown;
    page: number;
    onRetry: () => void;
    onPageChange: (page: number) => void;
  };
  transactionFilters: {
    startDate: string;
    endDate: string;
    paymentMethod: string;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onPaymentMethodChange: (value: string) => void;
    onReset: () => void;
  };
  studentScope: {
    canFilter: boolean;
    selectedStudent: StudentOption | null;
    options: StudentOption[];
    isLoading: boolean;
    error?: unknown;
    onValueChange: (studentId: string) => void;
    onSelectedStudentChange: (student: StudentOption | null) => void;
    onSearchChange: (value: string) => void;
    onClear: () => void;
    onRetry: () => void;
  };
  debts: {
    data?: PaginatedResponse<DebtRecord>;
    isLoading: boolean;
    error?: unknown;
    page: number;
    onRetry: () => void;
    onPageChange: (page: number) => void;
    outstandingAmount: number;
  };
  report: {
    data?: CashReport;
    isLoading: boolean;
    error?: unknown;
    rangeError?: string;
    startDate: string;
    endDate: string;
    paymentMethod: string;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onPaymentMethodChange: (value: string) => void;
    onPreset: (days: CashReportPreset) => void;
    onExportCsv: (report: CashReport) => void;
    onPrintPdf: (format: ReportPrintFormat) => void;
  };
  actions: {
    onDisputeTransaction: (transaction: CashTransaction) => void;
    onDisputeDebt: (debt: DebtRecord) => void;
    disputeQuota?: CashDisputeQuota;
  };
};

const LazyCashReportPanel = lazy(() =>
  import('./CashReportPanel').then(({ CashReportPanel }) => ({ default: CashReportPanel })),
);

const LazyCashTransactionFilter = lazy(() =>
  import('./CashTransactionFilter').then(({ CashTransactionFilter }) => ({ default: CashTransactionFilter })),
);

const LazyCashDebtFilter = lazy(() =>
  import('./CashDebtFilter').then(({ CashDebtFilter }) => ({ default: CashDebtFilter })),
);

export function CashPageTabs({
  navigation,
  paymentMethods: paymentMethodState,
  transactions: transactionState,
  transactionFilters,
  studentScope,
  debts: debtState,
  report: reportState,
  actions,
}: CashPageTabsProps) {
  const {
    currentView,
    isTreasurerOrTeacher,
    isStudent,
    isMobile,
    pageSize,
    onChange: setActiveView,
  } = navigation;
  const handleViewChange = (value: string) => {
    if (!isCashView(value)) return;
    setActiveView(value);
  };
  const { items: paymentMethods, isLoading: isPaymentMethodsLoading } = paymentMethodState;
  const {
    data: txData,
    isLoading: isTxLoading,
    error: txError,
    page: txPage,
    onRetry: onRetryTransactions,
    onPageChange: setTxPage,
  } = transactionState;
  const {
    startDate: tanggalMulai,
    endDate: tanggalSelesai,
    paymentMethod: metodePembayaran,
    onStartDateChange: setTanggalMulai,
    onEndDateChange: setTanggalSelesai,
    onPaymentMethodChange: setMetodePembayaran,
    onReset: onResetTransactionFilters,
  } = transactionFilters;
  const {
    canFilter: canFilterCashHistoryByStudent,
    selectedStudent: selectedHistoryStudent,
    options: historyStudentOptions,
    isLoading: isHistoryStudentOptionsLoading,
    error: historyStudentOptionsError,
    onValueChange: onHistoryStudentValueChange,
    onSelectedStudentChange: onSelectedHistoryStudentChange,
    onSearchChange: onHistoryStudentSearchChange,
    onClear: onClearStudentScope,
    onRetry: onRetryHistoryStudentOptions,
  } = studentScope;
  const {
    data: debtsData,
    isLoading: isDebtsLoading,
    error: debtsError,
    page: debtsPage,
    onRetry: onRetryDebts,
    onPageChange: setDebtsPage,
    outstandingAmount: outstandingDebt,
  } = debtState;
  const {
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
    onExportCsv,
    onPrintPdf: onPrintReport,
  } = reportState;
  const {
    onDisputeTransaction,
    onDisputeDebt,
    disputeQuota,
  } = actions;
  const isActivityView = currentView === 'activity';
  const isTransactionsView = currentView === 'transactions';
  const isDebtsView = currentView === 'debts';
  const isDisputesView = currentView === 'disputes';
  const isReportView = currentView === 'report';

  const handleResetReport = () => {
    handleReportPreset(30);
    setReportPaymentMethod('');
  };

  const handleExportReport = () => {
    if (reportData) onExportCsv(reportData);
  };

  const handleTransactionStartDateChange = (value: string) => {
    setTanggalMulai(value);
    setTxPage(1);
  };

  const handleTransactionEndDateChange = (value: string) => {
    setTanggalSelesai(value);
    setTxPage(1);
  };

  const handleTransactionPaymentMethodChange = (value: string) => {
    setMetodePembayaran(value);
    setTxPage(1);
  };

  const transactionContent = (() => {
    if (isTxLoading) return <CashSectionSkeleton rows={4} />;
    if (txError) {
      return <CashSectionError error={txError} title="Riwayat transaksi belum dapat dimuat" onRetry={onRetryTransactions} />;
    }

    const transactions = txData?.data ?? [];
    const list = isMobile
      ? <CashTransactionMobileList transactions={transactions} onDispute={onDisputeTransaction} isStudent={isStudent} disputeQuota={disputeQuota} />
      : <CashTransactionTable transactions={transactions} onDispute={onDisputeTransaction} isStudent={isStudent} disputeQuota={disputeQuota} />;

    return (
      <div className="space-y-4">
        {list}
        <Pagination
          page={txData?.page ?? txPage}
          totalPages={txData?.totalPages ?? 1}
          total={txData?.total ?? 0}
          pageSize={pageSize}
          onPageChange={setTxPage}
        />
      </div>
    );
  })();

  const debtContent = (() => {
    if (isDebtsLoading) return <CashSectionSkeleton rows={4} />;
    if (debtsError) {
      return <CashSectionError error={debtsError} title="Daftar tunggakan belum dapat dimuat" onRetry={onRetryDebts} />;
    }

    const debts = debtsData?.data ?? [];
    const list = isMobile
      ? <DebtRecordsMobileList debts={debts} isStudent={isStudent} onDispute={onDisputeDebt} disputeQuota={disputeQuota} />
      : <DebtRecordsTable debts={debts} isStudent={isStudent} onDispute={onDisputeDebt} disputeQuota={disputeQuota} />;

    return (
      <div className="space-y-4">
        {list}
        <Pagination
          page={debtsData?.page ?? debtsPage}
          totalPages={debtsData?.totalPages ?? 1}
          total={debtsData?.total ?? 0}
          pageSize={pageSize}
          onPageChange={setDebtsPage}
        />
      </div>
    );
  })();

  return (
    <div className="w-full">
      <AnimatedTabs
        id="cash-tabs"
        value={currentView}
        onValueChange={handleViewChange}
        ariaLabel="Menu kas"
        ariaControls="cash-view-panel"
        className="w-full md:w-fit"
        tabs={[
          ...(isTreasurerOrTeacher ? [{ value: 'activity', label: <><span className="md:hidden">Aktivitas</span><span className="hidden md:inline">Aktivitas Kas</span></> }] : []),
          { value: 'transactions', label: <><span className="md:hidden">Transaksi</span><span className="hidden md:inline">Riwayat Transaksi Kas</span></> },
          { value: 'debts', label: <><span className="md:hidden">Tunggakan</span><span className="hidden md:inline">{isStudent ? 'Tunggakan Saya' : 'Daftar Tunggakan Siswa'}</span></> },
          { value: 'disputes', label: <><span className="md:hidden">Sanggahan</span><span className="hidden md:inline">Sanggahan Kas</span></> },
          ...(isTreasurerOrTeacher ? [{ value: 'report', label: <><span className="md:hidden">Laporan</span><span className="hidden md:inline">Laporan Kas</span></> }] : []),
        ]}
      />

      <div id="cash-view-panel" role="tabpanel" aria-labelledby={`cash-tabs-${currentView}`} tabIndex={-1} className="mt-4">
        {isTreasurerOrTeacher && isActivityView && (
          <div>
            <CashOperationsOverview
              state={{
                transactions: txData?.data ?? [],
                isLoading: isTxLoading,
                error: txError,
                outstandingDebt,
              }}
              access={{ isMobile, isStudent }}
              actions={{
                onDispute: onDisputeTransaction,
                onRetry: onRetryTransactions,
                onViewTransactions: () => setActiveView('transactions'),
                onViewDebts: () => setActiveView('debts'),
              }}
            />
          </div>
        )}

        {isTreasurerOrTeacher && isReportView && (
          <div>
            <Suspense fallback={<CashSectionSkeleton rows={2} />}>
              <LazyCashReportPanel
                report={{ data: reportData, isLoading: isReportLoading, error: reportError, rangeError: reportRangeError }}
                filters={{
                  startDate: reportStartDate,
                  endDate: reportEndDate,
                  paymentMethodCode: reportPaymentMethod,
                  paymentMethods,
                  isPaymentMethodsLoading,
                  onStartDateChange: setReportStartDate,
                  onEndDateChange: setReportEndDate,
                  onPaymentMethodChange: setReportPaymentMethod,
                  onPreset: handleReportPreset,
                  onReset: handleResetReport,
                }}
                actions={{ onExportCsv: handleExportReport, onPrintPdf: onPrintReport }}
              />
            </Suspense>
          </div>
        )}

        {isTransactionsView && (
          <div>
            <Suspense fallback={<PanelSkeleton rows={2} label="Memuat filter transaksi..." className="mb-4" />}>
              <LazyCashTransactionFilter
                filters={{
                  startDate: tanggalMulai,
                  endDate: tanggalSelesai,
                  paymentMethodCode: metodePembayaran,
                  paymentMethods,
                  totalTransactions: txData?.total,
                }}
                studentScope={{
                  canFilter: canFilterCashHistoryByStudent,
                  selectedStudent: selectedHistoryStudent,
                  options: historyStudentOptions,
                  isLoading: isHistoryStudentOptionsLoading,
                  error: historyStudentOptionsError,
                }}
                actions={{
                  onStartDateChange: handleTransactionStartDateChange,
                  onEndDateChange: handleTransactionEndDateChange,
                  onPaymentMethodChange: handleTransactionPaymentMethodChange,
                  onStudentValueChange: onHistoryStudentValueChange,
                  onSelectedStudentChange: onSelectedHistoryStudentChange,
                  onStudentSearchChange: onHistoryStudentSearchChange,
                  onReset: onResetTransactionFilters,
                  onRetryStudentOptions: onRetryHistoryStudentOptions,
                }}
              />
            </Suspense>
            {transactionContent}
          </div>
        )}

        {isDebtsView && (
          <div>
            {canFilterCashHistoryByStudent && (
              <Suspense fallback={<PanelSkeleton rows={2} label="Memuat filter tunggakan..." className="mb-4" />}>
                <LazyCashDebtFilter
                  studentScope={{
                    selectedStudent: selectedHistoryStudent,
                    options: historyStudentOptions,
                    isLoading: isHistoryStudentOptionsLoading,
                    error: historyStudentOptionsError,
                    totalDebts: debtsData?.total,
                  }}
                  actions={{
                    onValueChange: onHistoryStudentValueChange,
                    onSelectedStudentChange: onSelectedHistoryStudentChange,
                    onSearchChange: onHistoryStudentSearchChange,
                    onClear: onClearStudentScope,
                    onRetry: onRetryHistoryStudentOptions,
                  }}
                />
              </Suspense>
            )}
            {debtContent}
          </div>
        )}

        {isDisputesView && (
          <div>
            <CashDisputeQueue reviewer={isTreasurerOrTeacher} scope={isStudent ? 'own' : 'manage'} />
          </div>
        )}
      </div>
    </div>
  );
}
