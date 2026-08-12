// src/features/cash/components/CashTransactionTable.tsx
// Table for cash transactions with dispute status and student dispute button

import { ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/feedback/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import type { CashTransaction } from '../types/cash.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditTable';

interface CashTransactionTableProps {
  transactions: CashTransaction[];
  onDispute?: (transaction: CashTransaction) => void;
  isStudent?: boolean;
}

export function CashTransactionTable({
  transactions,
  onDispute,
  isStudent = false,
}: CashTransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Belum ada transaksi kas"
        description="Belum terdapat transaksi kas masuk atau pengeluaran terdaftar."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Tanggal</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Tipe</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Siswa / Keterangan</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Metode</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold text-right">Nominal</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Sanggahan (Dispute)</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
            {isStudent && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {transactions.map((tx) => {
            const hasDispute = Boolean(tx.dispute);
            const disputeStatus = tx.dispute?.status;

            return (
              <TableRow key={tx.id} className="border-hairline hover:bg-surface-2/40">
                <TableCell className="text-ink-subtle text-xs">{formatDateShort(tx.tanggal)}</TableCell>

                <TableCell>
                  {tx.tipe === 'masuk' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-semantic-success bg-semantic-success/15 px-2 py-0.5 rounded-full">
                      <ArrowDownRight size={12} />
                      Masuk
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-semantic-danger bg-semantic-danger/15 px-2 py-0.5 rounded-full">
                      <ArrowUpRight size={12} />
                      Keluar
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-ink text-xs font-medium">
                  <div>
                    {tx.student_nama && <p className="font-semibold text-ink">{tx.student_nama}</p>}
                    <p className="text-ink-subtle text-xs font-normal">{tx.keterangan || '-'}</p>
                  </div>
                </TableCell>

                <TableCell className="whitespace-nowrap text-ink-subtle text-xs">{formatPaymentMethodLabel(tx.metode_pembayaran, tx.metode_pembayaran_label)}</TableCell>

                <TableCell className="text-right font-mono text-xs font-semibold">
                  <span className={tx.tipe === 'masuk' ? 'text-semantic-success' : 'text-semantic-danger'}>
                    {tx.tipe === 'masuk' ? '+' : '-'}{formatCurrency(tx.jumlah)}
                  </span>
                </TableCell>

                <TableCell>
                  {hasDispute ? (
                    <StatusBadge
                      label={
                        disputeStatus === 'pending'
                          ? 'Sanggahan Pending'
                          : disputeStatus === 'resolved'
                          ? 'Disetujui'
                          : 'Ditolak'
                      }
                      variant={
                        disputeStatus === 'pending'
                          ? 'warning'
                          : disputeStatus === 'resolved'
                          ? 'success'
                          : 'danger'
                      }
                    />
                  ) : (
                    <span className="text-ink-tertiary text-xs">-</span>
                  )}
                </TableCell>

                <TableCell className="text-right"><AuditHistoryButton tableName="cash_transactions" recordId={tx.id} /></TableCell>

                {isStudent && (
                  <TableCell className="text-right">
                    {tx.tipe === 'masuk' && !hasDispute && onDispute && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDispute(tx)}
                        className="bg-surface-2 border-hairline text-semantic-warning hover:bg-semantic-warning/15 text-xs h-7 px-2"
                      >
                        <AlertCircle size={12} className="mr-1" />
                        Sanggah
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
