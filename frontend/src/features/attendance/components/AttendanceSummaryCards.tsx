// src/features/attendance/components/AttendanceSummaryCards.tsx
// Summary cards for attendance metrics

import { CheckCircle2, AlertCircle, Clock, XCircle, Users } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/primitives/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { AttendanceSummaryMetrics } from '../types/attendance.types';

interface AttendanceSummaryCardsProps {
  summary?: AttendanceSummaryMetrics;
  isOwn?: boolean;
  totalLabel?: string;
}

export function AttendanceSummaryCards({ summary, isOwn = false, totalLabel }: AttendanceSummaryCardsProps) {
  const hadir = summary?.hadir ?? 0;
  const sakit = summary?.sakit ?? 0;
  const izin = summary?.izin ?? 0;
  const alpha = summary?.alpha ?? 0;
  const total = summary?.totalSiswa ?? 0;
  const persentase = summary?.persentaseHadir ?? (total > 0 ? Math.round((hadir / total) * 100) : 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* Persentase Kehadiran */}
      <Card className="bg-surface-1 border-hairline shadow-none col-span-2 sm:col-span-1">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Persentase Hadir</span>
            <Users size={14} className="text-primary" />
          </div>
          <div className="text-xl font-bold text-ink tracking-tight">{formatNumber(persentase, { maximumFractionDigits: 1 })}%</div>
          <p className="text-[10px] text-ink-tertiary mt-0.5">{formatNumber(hadir)} dari {formatNumber(total)} {totalLabel ?? (isOwn ? 'catatan' : 'siswa')}</p>
        </CardContent>
      </Card>

      {/* Hadir */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Hadir</span>
            <CheckCircle2 size={14} className="text-semantic-success" />
          </div>
          <div className="text-xl font-bold text-semantic-success tracking-tight">{formatNumber(hadir)}</div>
        </CardContent>
      </Card>

      {/* Sakit */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Sakit</span>
            <AlertCircle size={14} className="text-semantic-warning" />
          </div>
          <div className="text-xl font-bold text-semantic-warning tracking-tight">{formatNumber(sakit)}</div>
        </CardContent>
      </Card>

      {/* Izin */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Izin</span>
            <Clock size={14} className="text-semantic-warning" />
          </div>
          <div className="text-xl font-bold text-semantic-warning tracking-tight">{formatNumber(izin)}</div>
        </CardContent>
      </Card>

      {/* Alpha */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Alpha</span>
            <XCircle size={14} className="text-semantic-danger" />
          </div>
          <div className="text-xl font-bold text-semantic-danger tracking-tight">{formatNumber(alpha)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
