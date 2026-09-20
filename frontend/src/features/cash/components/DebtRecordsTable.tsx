
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
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { useCanViewAuditHistory } from '@/features/audit/hooks/useCanViewAuditHistory';
import { CashDisputeAction, CashDisputeStatus } from './CashDisputeState';

interface DebtRecordsTableProps {
  debts: DebtRecord[];
  isStudent: boolean;
  onDispute?: (debt: DebtRecord) => void;
  disputeQuota?: CashDisputeQuota;
}

export function DebtRecordsTable({ debts, isStudent, onDispute, disputeQuota }: DebtRecordsTableProps) {
  const canViewAuditHistory = useCanViewAuditHistory();

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
            <TableHead className="text-ink-subtle text-xs font-semibold">Sanggahan</TableHead>
            {canViewAuditHistory && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>}
            {isStudent && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
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
              <TableCell><CashDisputeStatus dispute={debt.dispute} /></TableCell>
              {canViewAuditHistory && <TableCell className="text-right"><AuditHistoryButton tableName="debt_records" recordId={debt.id} /></TableCell>}
              {isStudent && (
                <TableCell className="text-right">
                  {onDispute && (
                    <CashDisputeAction
                      dispute={debt.dispute}
                      quota={disputeQuota}
                      settled={debt.status === 'paid'}
                      onSubmit={() => onDispute(debt)}
                    />
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
