// src/features/borrowing/components/BorrowingTable.tsx
// Table for borrowing transactions with multi-item equipment lists, status badges, overdue alerts, and workflow actions

import { CheckCircle2, ArrowRightLeft, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BorrowingStatusBadge } from '@/components/feedback/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatStatusLabel } from '@/shared/utils/formatLabels';
import type { BorrowingRecord } from '../types/borrowing.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditTable';

interface BorrowingTableProps {
  borrowings: BorrowingRecord[];
  onApproveReject: (record: BorrowingRecord) => void;
  onHandover: (record: BorrowingRecord) => void;
  onReturn: (record: BorrowingRecord) => void;
  canManage?: boolean;
  canApprove?: boolean;
  canHandoverOrReturn?: boolean;
}

export function BorrowingTable({
  borrowings,
  onApproveReject,
  onHandover,
  onReturn,
  canManage = true,
  canApprove = true,
  canHandoverOrReturn = true,
}: BorrowingTableProps) {
  if (borrowings.length === 0) {
    return (
      <EmptyState
        title="Belum ada transaksi peminjaman"
        description="Tidak ditemukan riwayat atau pengajuan peminjaman alat sinematografi."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Peminjam &amp; Kelas</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Peralatan Dipinjam</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Keperluan</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Tgl Pinjam / Rencana Kembali</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Peminjaman</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Denda (Jika ada)</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
            {canManage && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi Workflow</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {borrowings.map((b) => (
            <TableRow key={b.id} className="border-hairline hover:bg-surface-2/40">
              {/* Borrower */}
              <TableCell className="text-ink text-xs font-medium">
                <div>
                  <p className="font-semibold">{b.borrower_nama}</p>
                  <p className="text-ink-tertiary text-[10px]">{b.kelas ?? '-'} {b.borrower_nis ? `• NIS: ${b.borrower_nis}` : ''}</p>
                </div>
              </TableCell>

              {/* Items */}
              <TableCell className="text-ink-subtle text-xs">
                <ul className="space-y-0.5">
                  {b.items.length === 0 ? (
                    <li className="text-ink-tertiary italic">Detail alat belum tersedia.</li>
                  ) : b.items.map((item) => (
                    <li key={item.borrowing_item_id ?? item.equipment_id} className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-primary font-semibold bg-primary/10 px-1 rounded">{item.kode_alat}</span>
                      <span className="truncate">{item.nama_alat}</span>
                      {item.status && <span className="text-[9px] text-ink-tertiary">({formatStatusLabel(item.status)})</span>}
                    </li>
                  ))}
                </ul>
              </TableCell>

              {/* Purpose */}
              <TableCell className="text-ink-subtle text-xs max-w-xs truncate">
                {b.keperluan}
              </TableCell>

              {/* Dates */}
              <TableCell className="text-ink-subtle text-xs">
                <div>
                  <p className="text-ink font-medium">{formatDateShort(b.tanggal_pinjam)}</p>
                  <p className="text-ink-tertiary text-[10px]">s/d {formatDateShort(b.rencana_kembali)}</p>
                </div>
              </TableCell>

              {/* Status */}
              <TableCell>
                <div className="space-y-1">
                  <BorrowingStatusBadge status={b.status} />
                  {b.status === 'terlambat' && (
                    <p className="text-[10px] font-semibold text-semantic-danger flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Melewati Tanggal!
                    </p>
                  )}
                </div>
              </TableCell>

              {/* Denda */}
              <TableCell className="text-xs font-mono font-medium">
                {b.total_denda && b.total_denda > 0 ? (
                  <span className="text-semantic-danger font-bold">{formatCurrency(b.total_denda)}</span>
                ) : (
                  <span className="text-ink-tertiary">Rp 0</span>
                )}
              </TableCell>

              <TableCell className="text-right"><AuditHistoryButton tableName="borrowings" recordId={b.id} /></TableCell>

              {/* Action Buttons */}
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                  {canApprove && b.status === 'menunggu_persetujuan' && (
                    <Button
                      size="sm"
                      onClick={() => onApproveReject(b)}
                      className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-7 px-2.5"
                    >
                      <CheckCircle2 size={12} className="mr-1" />
                      Persetujuan
                    </Button>
                  )}

                  {canHandoverOrReturn && b.status === 'disetujui' && (
                    <Button
                      size="sm"
                      onClick={() => onHandover(b)}
                      className="bg-semantic-success hover:bg-semantic-success/80 text-white text-xs h-7 px-2.5"
                    >
                      <ArrowRightLeft size={12} className="mr-1" />
                      Penyerahan Barang
                    </Button>
                  )}

                  {canHandoverOrReturn && (b.status === 'dipinjam' || b.status === 'terlambat') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReturn(b)}
                      className="bg-surface-2 border-hairline text-semantic-warning hover:bg-semantic-warning/20 text-xs h-7 px-2.5 font-medium"
                    >
                      <RotateCcw size={12} className="mr-1" />
                      Proses Pengembalian
                    </Button>
                  )}

                  {(b.status === 'dikembalikan' || b.status === 'ditolak') && (
                    <span className="text-ink-tertiary text-[11px] italic">Selesai</span>
                  )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
