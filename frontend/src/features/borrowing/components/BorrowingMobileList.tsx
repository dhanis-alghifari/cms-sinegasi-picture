import { AlertTriangle, ArrowRightLeft, CheckCircle2, MoreVertical, RotateCcw } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { BorrowingStatusBadge } from './BorrowingStatusBadge';
import { Button } from '@/shared/ui/primitives/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/primitives/dropdown-menu';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatStatusLabel } from '@/shared/utils/formatLabels';

import type { BorrowingRecord } from '../types/borrowing.types';

interface BorrowingMobileListProps {
  borrowings: BorrowingRecord[];
  onApproveReject: (record: BorrowingRecord) => void;
  onHandover: (record: BorrowingRecord) => void;
  onReturn: (record: BorrowingRecord) => void;
  canManage?: boolean;
  canApprove?: boolean;
  canHandoverOrReturn?: boolean;
}

export function BorrowingMobileList({
  borrowings,
  onApproveReject,
  onHandover,
  onReturn,
  canManage = true,
  canApprove = true,
  canHandoverOrReturn = true,
}: BorrowingMobileListProps) {
  if (borrowings.length === 0) {
    return (
      <EmptyState
        title="Belum ada transaksi peminjaman"
        description="Tidak ditemukan riwayat atau pengajuan peminjaman alat sinematografi."
      />
    );
  }

  return (
    <div className="space-y-3" aria-label="Daftar peminjaman versi ponsel">
      {borrowings.map((borrowing) => {
        const totalFine = borrowing.total_denda ?? 0;
        const hasAction = canManage && (
          (canApprove && borrowing.status === 'menunggu_persetujuan')
          || (canHandoverOrReturn && borrowing.status === 'disetujui')
          || (canHandoverOrReturn && (borrowing.status === 'dipinjam' || borrowing.status === 'terlambat'))
        );

        return (
          <article key={borrowing.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{borrowing.borrower_nama}</p>
                <p className="mt-1 truncate text-xs text-ink-tertiary">
                  {borrowing.kelas || 'Kelas belum tersedia'}{borrowing.borrower_nis ? ` · NIS ${borrowing.borrower_nis}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <AuditHistoryButton tableName="borrowings" recordId={borrowing.id} />
                {hasAction && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-ink-subtle" aria-label="Aksi peminjaman" />}>
                      <MoreVertical size={18} aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-hairline bg-surface-3 text-ink">
                      {canApprove && borrowing.status === 'menunggu_persetujuan' && (
                        <DropdownMenuItem onClick={() => onApproveReject(borrowing)} className="min-h-11 cursor-pointer text-sm">
                          <CheckCircle2 size={16} className="mr-2 text-primary" aria-hidden="true" />
                          Proses persetujuan
                        </DropdownMenuItem>
                      )}
                      {canHandoverOrReturn && borrowing.status === 'disetujui' && (
                        <DropdownMenuItem onClick={() => onHandover(borrowing)} className="min-h-11 cursor-pointer text-sm">
                          <ArrowRightLeft size={16} className="mr-2 text-semantic-success" aria-hidden="true" />
                          Serahkan alat
                        </DropdownMenuItem>
                      )}
                      {canHandoverOrReturn && (borrowing.status === 'dipinjam' || borrowing.status === 'terlambat') && (
                        <DropdownMenuItem onClick={() => onReturn(borrowing)} className="min-h-11 cursor-pointer text-sm">
                          <RotateCcw size={16} className="mr-2 text-semantic-warning" aria-hidden="true" />
                          Proses pengembalian
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Peralatan</p>
              <ul className="mt-2 space-y-1.5">
                {borrowing.items.length === 0 ? (
                  <li className="text-xs italic text-ink-tertiary">Detail alat belum tersedia.</li>
                ) : borrowing.items.map((item) => (
                  <li key={item.borrowing_item_id ?? item.equipment_id} className="flex min-w-0 items-center gap-2 text-xs text-ink-subtle">
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">{item.kode_alat}</span>
                    <span className="min-w-0 truncate">{item.nama_alat}</span>
                    {item.status && <span className="shrink-0 text-[10px] text-ink-tertiary">({formatStatusLabel(item.status)})</span>}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-3 line-clamp-2 text-xs text-ink-subtle">{borrowing.keperluan || 'Keperluan belum diisi'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-hairline p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Periode</p>
                <p className="mt-1 font-medium text-ink">{formatDateShort(borrowing.tanggal_pinjam)}</p>
                <p className="text-[10px] text-ink-tertiary">s/d {formatDateShort(borrowing.rencana_kembali)}</p>
              </div>
              <div className="rounded-lg border border-hairline p-2.5 text-right">
                <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Status</p>
                <div className="mt-1 flex justify-end"><BorrowingStatusBadge status={borrowing.status} /></div>
                {borrowing.status === 'terlambat' && <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-semantic-danger"><AlertTriangle size={11} aria-hidden="true" />Terlambat</p>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-tertiary">Tagihan</span>
              <span className={totalFine > 0 ? 'font-semibold text-semantic-danger' : 'text-ink-tertiary'}>{formatCurrency(totalFine)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
