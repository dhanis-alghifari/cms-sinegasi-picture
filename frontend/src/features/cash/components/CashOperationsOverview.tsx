import { AlertCircle, ArrowRight } from 'lucide-react';

import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { formatCurrency } from '@/shared/utils/formatCurrency';

import { CashTransactionMobileList } from './CashTransactionMobileList';
import { CashTransactionTable } from './CashTransactionTable';
import { CashSectionError, CashSectionSkeleton } from './CashSectionState';
import type { CashTransaction } from '../types/cash.types';

interface CashOperationsOverviewProps {
  state: {
    transactions: CashTransaction[];
    isLoading: boolean;
    error?: unknown;
    outstandingDebt: number;
  };
  access: {
    isMobile: boolean;
    isStudent: boolean;
  };
  actions: {
    onDispute?: (transaction: CashTransaction) => void;
    onRetry: () => void;
    onViewTransactions: () => void;
    onViewDebts: () => void;
  };
}

export function CashOperationsOverview({
  state,
  access,
  actions,
}: CashOperationsOverviewProps) {
  const { transactions, isLoading, error, outstandingDebt } = state;
  const { isMobile, isStudent } = access;
  const { onDispute, onRetry, onViewTransactions, onViewDebts } = actions;

  const transactionContent = (() => {
    if (isLoading) return <CashSectionSkeleton rows={3} />;
    if (error) return <CashSectionError error={error} onRetry={onRetry} title="Transaksi terbaru belum tersedia" />;
    if (transactions.length === 0) {
      return (
        <EmptyState
          title="Belum ada transaksi kas"
          description="Catat kas masuk atau pengeluaran pertama untuk mulai membangun riwayat kas."
          action={(
            <Button type="button" variant="outline" onClick={onViewTransactions} className="min-h-11 text-sm text-ink">
              Buka riwayat transaksi
            </Button>
          )}
        />
      );
    }
    return isMobile
      ? <CashTransactionMobileList transactions={transactions} onDispute={onDispute} isStudent={isStudent} />
      : <CashTransactionTable transactions={transactions} onDispute={onDispute} isStudent={isStudent} />;
  })();

  return (
    <div className="space-y-4">
      {outstandingDebt > 0 && !isStudent && (
        <Card className="border-semantic-warning/30 bg-semantic-warning/5 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-semantic-warning" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Perlu perhatian: tunggakan siswa</p>
                <p className="mt-1 text-sm text-ink-subtle">
                  Total tunggakan saat ini {formatCurrency(outstandingDebt)}.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onViewDebts}
              className="min-h-11 shrink-0 gap-2 text-sm text-ink"
            >
              Lihat tunggakan
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-hairline bg-surface-1 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 sm:p-5">
          <CardTitle className="text-base font-semibold text-ink">Transaksi terbaru</CardTitle>
          <Button
            type="button"
            variant="ghost"
            onClick={onViewTransactions}
            className="min-h-11 shrink-0 gap-1 px-2 text-sm text-primary hover:text-primary-hover"
          >
            Lihat semua
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {transactionContent}
        </CardContent>
      </Card>
    </div>
  );
}
