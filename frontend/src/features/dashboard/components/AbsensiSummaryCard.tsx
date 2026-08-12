// src/features/dashboard/components/AbsensiSummaryCard.tsx
// Dashboard widget — Ringkasan Absensi Siswa Hari Ini

import { CalendarCheck, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { AbsensiSummary } from '../types/dashboard.types';

interface AbsensiSummaryCardProps {
  data?: AbsensiSummary;
}

export function AbsensiSummaryCard({ data }: AbsensiSummaryCardProps) {
  const hadir = data?.hadir ?? 0;
  const sakit = data?.sakit ?? 0;
  const izin = data?.izin ?? 0;
  const alpha = data?.alpha ?? 0;
  const total = data?.totalSiswa ?? 0;
  const persentase = data?.persentaseHadir ?? (total > 0 ? Math.round((hadir / total) * 100) : 0);
  const hasBreakdown = [data?.hadir, data?.sakit, data?.izin, data?.alpha].every((value) => value !== undefined);

  return (
    <Card className="bg-surface-1 border-hairline shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-ink text-sm font-medium">Absensi Hari Ini</CardTitle>
        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
          <CalendarCheck size={16} className="text-semantic-success" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-2xl font-bold text-ink tracking-tight">
            {hasBreakdown ? `${formatNumber(hadir)} / ${formatNumber(total)} Siswa` : `${formatNumber(persentase, { maximumFractionDigits: 1 })}%`}
            {!hasBreakdown && <span className="text-sm font-normal text-ink-subtle"> Kehadiran</span>}
          </div>
          <div className="text-xs font-semibold text-semantic-success bg-semantic-success/15 px-2 py-0.5 rounded-full">
            {formatNumber(persentase, { maximumFractionDigits: 1 })}% Hadir
          </div>
        </div>

        {hasBreakdown && <div className="grid grid-cols-4 gap-2 pt-2 border-t border-hairline">
          <div className="flex flex-col items-center p-1.5 rounded-md bg-surface-2/60">
            <CheckCircle2 size={14} className="text-semantic-success mb-1" />
            <span className="text-[10px] text-ink-subtle">Hadir</span>
            <span className="text-xs font-semibold text-ink">{formatNumber(hadir)}</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded-md bg-surface-2/60">
            <AlertCircle size={14} className="text-semantic-warning mb-1" />
            <span className="text-[10px] text-ink-subtle">Sakit</span>
            <span className="text-xs font-semibold text-ink">{formatNumber(sakit)}</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded-md bg-surface-2/60">
            <Clock size={14} className="text-semantic-warning mb-1" />
            <span className="text-[10px] text-ink-subtle">Izin</span>
            <span className="text-xs font-semibold text-ink">{formatNumber(izin)}</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded-md bg-surface-2/60">
            <XCircle size={14} className="text-semantic-danger mb-1" />
            <span className="text-[10px] text-ink-subtle">Alpha</span>
            <span className="text-xs font-semibold text-ink">{formatNumber(alpha)}</span>
          </div>
        </div>}
      </CardContent>
    </Card>
  );
}
