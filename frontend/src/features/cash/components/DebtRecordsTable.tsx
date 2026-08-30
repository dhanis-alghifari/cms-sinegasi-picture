// src/features/cash/components/DebtRecordsTable.tsx
// Table for student debt records (Auto-Debt Management)

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import type { CashDisputeQuota, DebtRecord } from '../types/cash.types';
import { getDisputeAction } from '../utils/disputeState';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { Button } from '@/shared/ui/primitives/button';
import type { MouseEvent } from 'react';

interface DebtRecordsTableProps {
  debts: DebtRecord[];
  isStudent?: boolean;
  onDispute?: (debt: DebtRecord) => void;
  disputeQuota?: CashDisputeQuota;
}

export function DebtRecordsTable({ debts, isStudent = false, onDispute, disputeQuota }: DebtRecordsTableProps) {
  if (debts.length === 0) {
    return (
      <EmptyState
        title={isStudent ? 'Tidak ada tunggakan' : 'Tidak ada tunggakan siswa'}
        description={isStudent ? 'Semua iuran kas Anda sudah tercatat lunas.' : 'Semua siswa telah melunasi iuran kas wajib.'}
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Tanggal Tagihan</TableHead>
            {!isStudent && <TableHead className="text-ink-subtle text-xs font-semibold">Nama Siswa</TableHead>}
            <TableHead className="text-ink-subtle text-xs font-semibold text-right">Jumlah Utang (Tunggakan)</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Pembayaran</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {debts.map((debt) => (
            <TableRow key={debt.id} className="border-hairline hover:bg-surface-2/40">
              <TableCell className="text-ink-subtle text-xs">{formatDateShort(debt.created_at)}</TableCell>
              {!isStudent && <TableCell className="text-ink font-medium text-xs">{debt.student_nama ?? 'Siswa'}</TableCell>}
              <TableCell className="text-right font-mono text-xs font-semibold text-semantic-danger">
                {formatCurrency(debt.amount)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={debt.status === 'paid' ? 'Lunas' : 'Belum Lunas'}
                  variant={debt.status === 'paid' ? 'success' : 'danger'}
                />
              </TableCell>
              <TableCell className="text-right"><div className="flex items-center justify-end gap-2"><AuditHistoryButton tableName="debt_records" recordId={debt.id} />{isStudent && onDispute && (() => { const action = getDisputeAction(debt.dispute, disputeQuota, debt.status === 'paid'); return <Button type="button" size="sm" disabled={!action.canSubmit} title={action.reason} className="min-h-9 border-primary bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary/30" onClick={(event: MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); onDispute(debt); }}>{action.label}</Button>; })()}</div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
