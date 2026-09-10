// src/features/cash/components/CashPageTabs.tsx
// Tab navigation and content for the cash page.

import { lazy, Suspense } from 'react';

import { Pagination } from '@/shared/ui/Pagination';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import type { PaginatedResponse } from '@/shared/types/common';

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

type CashPageTabsProps = {
  currentView: CashView;
  isTreasurerOrTeacher: boolean;
  isStudent: boolean;
  isMobile: boolean;
  pageSize: number;
  paymentMethods: CashPaymentMethod[];
  isPaymentMethodsLoading: boolean;
  paymentMethodsError?: unknown;
  txData?: PaginatedResponse<CashTransaction>;
  isTxLoading: boolean;
  txError?: unknown;
  txPage: number;
  onRetryTransactions: () => void;
  setTxPage: (page: number) => void;
  tanggalMulai: string;
  tanggalSelesai: string;
  metodePembayaran: string;
  setTanggalMulai: (value: string) => void;
  setTanggalSelesai: (value: string) => void;
  setMetodePembayaran: (value: string) => void;
  debtsData?: PaginatedResponse<DebtRecord>;
  isDebtsLoading: boolean;
  debtsError?: unknown;
  debtsPage: number;
  onRetryDebts: () => void;
  setDebtsPage: (page: number) => void;
  disputeQuota?: CashDisputeQuota;
  outstandingDebt: number;
  reportData?: CashReport;
  isReportLoading: boolean;
  reportError?: unknown;
  reportRangeError?: string;
  reportStartDate: string;
  reportEndDate: string;
  reportPaymentMethod: string;
  setReportStartDate: (value: string) => void;
  setReportEndDate: (value: string) => void;
  setReportPaymentMethod: (value: string) => void;
  handleReportPreset: (days: CashReportPreset) => void;
  onExportCsv: (report: CashReport) => void;
  onPrintReport: () => void;
  onDisputeTransaction: (transaction: CashTransaction) => void;
  onDisputeDebt: (debt: DebtRecord) => void;
  setActiveView: (view: CashView) => void;
};

const LazyCashReportPanel = lazy(() =>
  import('./CashReportPanel').then(({ CashReportPanel }) => ({ default: CashReportPanel })),
);

export function CashPageTabs({
  currentView,
  isTreasurerOrTeacher,
  isStudent,
  isMobile,
  pageSize,
  paymentMethods,
  isPaymentMethodsLoading,
  txData,
  isTxLoading,
  txError,
  txPage,
  onRetryTransactions,
  setTxPage,
  tanggalMulai,
  tanggalSelesai,
  metodePembayaran,
  setTanggalMulai,
  setTanggalSelesai,
  setMetodePembayaran,
  debtsData,
  isDebtsLoading,
  debtsError,
  debtsPage,
  onRetryDebts,
  setDebtsPage,
  disputeQuota,
  outstandingDebt,
  reportData,
  isReportLoading,
  reportError,
  reportRangeError,
  reportStartDate,
  reportEndDate,
  reportPaymentMethod,
  setReportStartDate,
  setReportEndDate,
  setReportPaymentMethod,
  handleReportPreset,
  onExportCsv,
  onPrintReport,
  onDisputeTransaction,
  onDisputeDebt,
  setActiveView,
}: CashPageTabsProps) {
  const isActivityView = currentView === 'activity';
  const isTransactionsView = currentView === 'transactions';
  const isDebtsView = currentView === 'debts';
  const isDisputesView = currentView === 'disputes';
  const isReportView = currentView === 'report';

  return (
      <Tabs
        value={currentView}
        onValueChange={(value) => setActiveView(value as CashView)}
        className="w-full"
      >
        <TabsList
          className={`grid min-h-14 w-full gap-1 bg-surface-1 p-2 md:flex md:h-auto md:min-h-0 md:w-fit md:gap-2 md:p-1 ${isTreasurerOrTeacher ? "grid-cols-5" : "grid-cols-3"}`}
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
              <span className="hidden md:inline">{isStudent ? 'Tunggakan Saya' : 'Daftar Tunggakan Siswa'}</span>
          </TabsTrigger>
          <TabsTrigger
            value="disputes"
            className="min-h-12 min-w-0 flex-1 px-1 text-xs leading-tight md:min-h-9 md:min-w-36 md:flex-none md:whitespace-nowrap md:px-3 data-[state=active]:bg-surface-2 data-[state=active]:text-ink"
          >
            <span className="md:hidden">Sanggahan</span>
            <span className="hidden md:inline">Sanggahan Kas</span>
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
              outstandingDebt={outstandingDebt}
              onDispute={onDisputeTransaction}
              onRetry={() => {
                onRetryTransactions();
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
                  if (reportData) onExportCsv(reportData);
                }}
                onPrintPdf={onPrintReport}
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
                className="text-xs text-ink md:w-44"
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
                className="text-xs text-ink md:w-44"
              />
              <Select
                value={metodePembayaran || "all"}
                onValueChange={(value) => {
                  setMetodePembayaran(value === "all" || !value ? "" : value);
                  setTxPage(1);
                }}
              >
                <SelectTrigger
                  className="text-xs text-ink md:w-48"
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
                  onRetryTransactions();
                }}
              />
            ) : (
              <div className="space-y-4">
                {isMobile ? (
                  <CashTransactionMobileList
                    transactions={txData?.data ?? []}
                    onDispute={onDisputeTransaction}
                    isStudent={isStudent}
                    disputeQuota={disputeQuota}
                  />
                ) : (
                  <CashTransactionTable
                    transactions={txData?.data ?? []}
                    onDispute={onDisputeTransaction}
                    isStudent={isStudent}
                    disputeQuota={disputeQuota}
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
                  onRetryDebts();
                }}
              />
            ) : (
              <div className="space-y-4">
                {isMobile ? (
                  <DebtRecordsMobileList debts={debtsData?.data ?? []} isStudent={isStudent} onDispute={onDisputeDebt} disputeQuota={disputeQuota} />
                ) : (
                  <DebtRecordsTable debts={debtsData?.data ?? []} isStudent={isStudent} onDispute={onDisputeDebt} disputeQuota={disputeQuota} />
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

        {isDisputesView && (
          <TabsContent value="disputes" className="mt-4">
            <CashDisputeQueue reviewer={isTreasurerOrTeacher} />
          </TabsContent>
        )}
      </Tabs>
  );
}
