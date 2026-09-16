import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';

import type { CashReportDailyPoint } from '../types/cash.types';
import { getActiveCashReportDays } from '../utils/cashReportRows';

interface CashReportDailyPrintTableProps {
  rows: CashReportDailyPoint[];
}

export function CashReportDailyPrintTable({ rows }: CashReportDailyPrintTableProps) {
  const activeRows = getActiveCashReportDays(rows);

  if (activeRows.length === 0) {
    return <p className="py-8 text-center text-xs text-ink-tertiary">Belum ada aktivitas pada periode ini.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          <TableHead className="text-right">Pemasukan</TableHead>
          <TableHead className="text-right">Pengeluaran</TableHead>
          <TableHead className="text-right">Net</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeRows.map((item) => (
          <TableRow key={item.date}>
            <TableCell>{formatDateShort(item.date)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.income)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.expense)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.income - item.expense)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
