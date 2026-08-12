// src/features/cash/components/DebtRecordsTable.tsx
// Table for student debt records (Auto-Debt Management)

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/feedback/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import type { DebtRecord } from '../types/cash.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditTable';

interface DebtRecordsTableProps {
  debts: DebtRecord[];
}

export function DebtRecordsTable({ debts }: DebtRecordsTableProps) {
  if (debts.length === 0) {
    return (
      <EmptyState
        title="Tidak ada tunggakan siswa"
        description="Semua siswa telah melunasi iuran kas wajib."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Tanggal Tagihan</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Nama Siswa</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold text-right">Jumlah Utang (Tunggakan)</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Pembayaran</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {debts.map((debt) => (
            <TableRow key={debt.id} className="border-hairline hover:bg-surface-2/40">
              <TableCell className="text-ink-subtle text-xs">{formatDateShort(debt.created_at)}</TableCell>
              <TableCell className="text-ink font-medium text-xs">{debt.student_nama ?? 'Siswa'}</TableCell>
              <TableCell className="text-right font-mono text-xs font-semibold text-semantic-danger">
                {formatCurrency(debt.amount)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={debt.status === 'paid' ? 'Lunas' : 'Belum Lunas'}
                  variant={debt.status === 'paid' ? 'success' : 'danger'}
                />
              </TableCell>
              <TableCell className="text-right"><AuditHistoryButton tableName="debt_records" recordId={debt.id} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
