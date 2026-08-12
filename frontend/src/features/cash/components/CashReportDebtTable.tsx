import { EmptyState } from '@/components/common/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/shared/utils/formatCurrency';

import type { CashReportDebtStudent } from '../types/cash.types';

interface CashReportDebtTableProps {
  debts: CashReportDebtStudent[];
}

export function CashReportDebtTable({ debts }: CashReportDebtTableProps) {
  if (debts.length === 0) {
    return (
      <EmptyState
        title="Tidak ada siswa menunggak"
        description="Tidak ada tunggakan yang tercatat pada periode laporan ini."
      />
    );
  }

  return (
    <Table>
      <TableHeader className="bg-surface-2/60">
        <TableRow className="border-hairline">
          <TableHead className="text-xs text-ink-subtle">Nama siswa</TableHead>
          <TableHead className="text-xs text-ink-subtle">Kelas</TableHead>
          <TableHead className="text-right text-xs text-ink-subtle">Catatan</TableHead>
          <TableHead className="text-right text-xs text-ink-subtle">Total tunggakan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {debts.map((debt) => (
          <TableRow key={debt.student_id} className="border-hairline">
            <TableCell className="text-xs font-medium text-ink">{debt.student_nama}</TableCell>
            <TableCell className="text-xs text-ink-subtle">{debt.kelas || '-'}</TableCell>
            <TableCell className="text-right text-xs text-ink-subtle">{debt.debt_record_count}</TableCell>
            <TableCell className="text-right text-xs font-semibold text-semantic-danger">
              {formatCurrency(debt.total_debt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
