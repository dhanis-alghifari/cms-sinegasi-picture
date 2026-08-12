// src/features/dashboard/components/AlatStatusCard.tsx
// Dashboard widget — Status Alat Sinematografi

import { Camera, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { AlatStatusSummary } from '../types/dashboard.types';

interface AlatStatusCardProps {
  data?: AlatStatusSummary;
}

export function AlatStatusCard({ data }: AlatStatusCardProps) {
  const tersedia = data?.tersedia ?? 0;
  const dipinjam = data?.dipinjam ?? 0;
  const maintenance = data?.maintenance ?? 0;
  const rusak = data?.rusak ?? 0;
  const overdueCount = data?.overdueCount ?? 0;
  const hasStatusBreakdown = [data?.tersedia, data?.dipinjam, data?.maintenance, data?.rusak].some((value) => value !== undefined);

  return (
    <Card className="bg-surface-1 border-hairline shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-ink text-sm font-medium">Katalog & Status Alat</CardTitle>
        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
          <Camera size={16} className="text-primary" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-2xl font-bold text-ink tracking-tight">
            {hasStatusBreakdown ? formatNumber(tersedia) : formatNumber(data?.totalAlat ?? 0)}
            <span className="text-sm font-normal text-ink-subtle">{hasStatusBreakdown ? ' Tersedia' : ' Total Alat'}</span>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-semantic-danger bg-semantic-danger/15 px-2 py-0.5 rounded-full">
              <AlertTriangle size={12} />
              {formatNumber(overdueCount)} Overdue
            </div>
          )}
        </div>

        {hasStatusBreakdown && <div className="space-y-2 pt-2 border-t border-hairline">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-subtle">Sedang Dipinjam</span>
            <span className="font-semibold text-primary">{formatNumber(dipinjam)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-subtle">Dalam Perbaikan / Maintenance</span>
            <span className="font-semibold text-semantic-warning">{formatNumber(maintenance)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-subtle">Rusak / Hilang</span>
            <span className="font-semibold text-semantic-danger">{formatNumber(rusak)}</span>
          </div>
        </div>}
      </CardContent>
    </Card>
  );
}
