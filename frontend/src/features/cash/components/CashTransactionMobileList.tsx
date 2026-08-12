import { AlertCircle, ArrowDownRight, ArrowUpRight, MoreVertical } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/feedback/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';

import type { CashTransaction } from '../types/cash.types';

interface CashTransactionMobileListProps {
  transactions: CashTransaction[];
  onDispute?: (transaction: CashTransaction) => void;
  isStudent?: boolean;
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
  isStudent = false,
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
        const canDispute = isStudent && isIncome && !transaction.dispute && Boolean(onDispute);

        return (
          <article key={transaction.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
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

              <div className="flex shrink-0 items-start gap-1">
                <AuditHistoryButton tableName="cash_transactions" recordId={transaction.id} />
                {canDispute && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-ink-subtle" aria-label="Aksi transaksi" />}>
                      <MoreVertical size={18} aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-hairline bg-surface-3 text-ink">
                      <DropdownMenuItem onClick={() => onDispute?.(transaction)} className="min-h-11 cursor-pointer text-sm">
                        <AlertCircle size={16} className="mr-2 text-semantic-warning" aria-hidden="true" />
                        Ajukan sanggahan
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
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
          </article>
        );
      })}
    </div>
  );
}
