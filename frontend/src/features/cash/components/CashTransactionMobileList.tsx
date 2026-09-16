import { AlertCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Button } from '@/shared/ui/primitives/button';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';

import type { CashDisputeQuota, CashTransaction } from '../types/cash.types';
import { getDisputeAction } from '../utils/disputeState';

interface CashTransactionMobileListProps {
  transactions: CashTransaction[];
  onDispute?: (transaction: CashTransaction) => void;
  isStudent: boolean;
  disputeQuota?: CashDisputeQuota;
}

function getDisputeStatus(transaction: CashTransaction) {
  const status = transaction.dispute?.status;
  if (status === 'pending') return { label: 'Sanggahan pending', variant: 'warning' as const };
  if (status === 'resolved') return { label: 'Sanggahan disetujui', variant: 'success' as const };
  if (status === 'rejected') return { label: 'Sanggahan ditolak', variant: 'danger' as const };
  return null;
}

export function CashTransactionMobileList({
  transactions,
  onDispute,
  isStudent,
  disputeQuota,
}: CashTransactionMobileListProps) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Belum ada transaksi kas"
        description="Belum terdapat transaksi kas masuk atau pengeluaran terdaftar."
      />
    );
  }

  return (
    <div className="space-y-3" aria-label="Daftar transaksi kas versi ponsel">
      {transactions.map((transaction) => {
        const isIncome = transaction.tipe === 'masuk';
        const disputeStatus = getDisputeStatus(transaction);
        const disputeAction = getDisputeAction(transaction.dispute, disputeQuota);
        const canDispute = isStudent && isIncome && Boolean(onDispute);

        return (
          <article key={transaction.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={isIncome
                    ? 'inline-flex items-center gap-1 rounded-full bg-semantic-success/15 px-2 py-1 text-[11px] font-semibold text-semantic-success'
                    : 'inline-flex items-center gap-1 rounded-full bg-semantic-danger/15 px-2 py-1 text-[11px] font-semibold text-semantic-danger'}>
                    {isIncome ? <ArrowDownRight size={13} aria-hidden="true" /> : <ArrowUpRight size={13} aria-hidden="true" />}
                    {isIncome ? 'Masuk' : 'Keluar'}
                  </span>
                  <span className="text-xs text-ink-tertiary">{formatDateShort(transaction.tanggal)}</span>
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-ink">
                  {transaction.student_nama || 'Transaksi umum'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-subtle">{transaction.keterangan || 'Tanpa keterangan'}</p>
              </div>

              <AuditHistoryButton tableName="cash_transactions" recordId={transaction.id} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Metode</p>
                <p className="mt-1 truncate text-xs font-medium text-ink-subtle">
                  {formatPaymentMethodLabel(transaction.metode_pembayaran, transaction.metode_pembayaran_label)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Nominal</p>
                <p className={isIncome ? 'mt-1 text-sm font-semibold text-semantic-success' : 'mt-1 text-sm font-semibold text-semantic-danger'}>
                  {isIncome ? '+' : '-'}{formatCurrency(transaction.jumlah)}
                </p>
              </div>
            </div>

            {disputeStatus && (
              <div className="mt-2">
                <StatusBadge label={disputeStatus.label} variant={disputeStatus.variant} />
              </div>
            )}

            {canDispute && (
              <div className="mt-3 flex justify-end border-t border-hairline pt-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={!disputeAction.canSubmit}
                  title={disputeAction.reason}
                  onClick={() => onDispute?.(transaction)}
                  className="min-h-11 w-full border-primary bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary/30 sm:w-auto"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  {disputeAction.label}
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
