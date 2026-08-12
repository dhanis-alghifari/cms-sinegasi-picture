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
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatEnumLabel, formatPaymentMethodLabel } from '@/shared/utils/formatLabels';

import type { CashReportDetail } from '../types/cash.types';

interface CashReportDetailTableProps {
  rows: CashReportDetail[];
  kind: 'income' | 'expense';
}

export function CashReportDetailTable({ rows, kind }: CashReportDetailTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={kind === 'income' ? 'Belum ada pemasukan' : 'Belum ada pengeluaran'}
        description="Tidak ada transaksi pada periode laporan yang dipilih."
      />
    );
  }

  return (
    <div className="cash-report-scroll max-h-[28rem] overflow-auto rounded-md border border-hairline">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="whitespace-nowrap text-xs text-ink-subtle">Tanggal</TableHead>
            {kind === 'income' && <TableHead className="text-xs text-ink-subtle">Jenis</TableHead>}
            {kind === 'income' && <TableHead className="text-xs text-ink-subtle">Siswa</TableHead>}
            {kind === 'income' && <TableHead className="hidden text-xs text-ink-subtle sm:table-cell">Kelas</TableHead>}
            <TableHead className="text-xs text-ink-subtle">Metode</TableHead>
            <TableHead className="text-right text-xs text-ink-subtle">Nominal</TableHead>
            <TableHead className="text-xs text-ink-subtle">Keterangan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-hairline">
              <TableCell className="whitespace-nowrap text-xs text-ink-subtle">{formatDateShort(row.date)}</TableCell>
              {kind === 'income' && <TableCell className="whitespace-nowrap text-xs text-ink">{row.label || formatEnumLabel(row.type)}</TableCell>}
              {kind === 'income' && <TableCell className="max-w-[12rem] truncate text-xs text-ink">{row.student_name || 'Umum'}</TableCell>}
              {kind === 'income' && <TableCell className="hidden text-xs text-ink-subtle sm:table-cell">{row.kelas || '-'}</TableCell>}
              <TableCell className="whitespace-nowrap text-xs text-ink-subtle">{formatPaymentMethodLabel(row.payment_method_code, row.payment_method_label)}</TableCell>
              <TableCell className="whitespace-nowrap text-right text-xs font-semibold text-ink">{formatCurrency(row.amount)}</TableCell>
              <TableCell className="max-w-[16rem] truncate text-xs text-ink-subtle">{row.note || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
