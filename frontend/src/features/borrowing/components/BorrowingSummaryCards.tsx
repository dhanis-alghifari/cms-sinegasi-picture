
import { PackageCheck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/primitives/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { BorrowingSummary } from '../types/borrowing.types';

interface BorrowingSummaryCardsProps {
  summary?: BorrowingSummary;
}

export function BorrowingSummaryCards({ summary }: BorrowingSummaryCardsProps) {
  const totalActive = summary?.totalActive ?? 0;
  const pendingApproval = summary?.pendingApproval ?? 0;
  const overdueCount = summary?.overdueCount ?? 0;
  const returnedToday = summary?.returnedToday ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Active Borrowings */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Sedang Dipinjam</span>
            <PackageCheck size={14} className="text-primary" />
          </div>
          <div className="text-xl font-bold text-ink tracking-tight">{formatNumber(totalActive)} Transaksi</div>
        </CardContent>
      </Card>

      {/* Pending Approval */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Menunggu Persetujuan</span>
            <Clock size={14} className="text-semantic-warning" />
          </div>
          <div className="text-xl font-bold text-semantic-warning tracking-tight">{formatNumber(pendingApproval)} Ajuan</div>
        </CardContent>
      </Card>

      {/* Overdue Count */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Terlambat (Overdue)</span>
            <AlertTriangle size={14} className="text-semantic-danger" />
          </div>
          <div className="text-xl font-bold text-semantic-danger tracking-tight">{formatNumber(overdueCount)} Peminjam</div>
        </CardContent>
      </Card>

      {/* Returned Today */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Dikembalikan Hari Ini</span>
            <CheckCircle2 size={14} className="text-semantic-success" />
          </div>
          <div className="text-xl font-bold text-semantic-success tracking-tight">{formatNumber(returnedToday)} Transaksi</div>
        </CardContent>
      </Card>
    </div>
  );
}
