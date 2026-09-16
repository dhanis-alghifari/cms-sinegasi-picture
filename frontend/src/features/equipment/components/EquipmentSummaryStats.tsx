
import { Camera, CheckCircle2, PackageCheck, Wrench, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/primitives/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { EquipmentSummary } from '../types/equipment.types';

interface EquipmentSummaryStatsProps {
  summary?: EquipmentSummary;
}

export function EquipmentSummaryStats({ summary }: EquipmentSummaryStatsProps) {
  const total = summary?.totalAlat ?? 0;
  const tersedia = summary?.tersedia ?? 0;
  const dipinjam = summary?.dipinjam ?? 0;
  const maintenance = summary?.maintenance ?? 0;
  const rusak = summary?.rusak ?? 0;
  const hilang = summary?.hilang ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {/* Total Inventory */}
      <Card className="bg-surface-1 border-hairline shadow-none col-span-2 sm:col-span-1">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Total Katalog</span>
            <Camera size={14} className="text-primary" />
          </div>
          <div className="text-xl font-bold text-ink tracking-tight">{formatNumber(total)} Unit</div>
        </CardContent>
      </Card>

      {/* Tersedia */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Tersedia Siap Pinjam</span>
            <CheckCircle2 size={14} className="text-semantic-success" />
          </div>
          <div className="text-xl font-bold text-semantic-success tracking-tight">{formatNumber(tersedia)}</div>
        </CardContent>
      </Card>

      {/* Sedang Dipinjam */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Sedang Dipinjam</span>
            <PackageCheck size={14} className="text-primary" />
          </div>
          <div className="text-xl font-bold text-primary tracking-tight">{formatNumber(dipinjam)}</div>
        </CardContent>
      </Card>

      {/* Dalam Perbaikan / Maintenance */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Maintenance</span>
            <Wrench size={14} className="text-semantic-warning" />
          </div>
          <div className="text-xl font-bold text-semantic-warning tracking-tight">{formatNumber(maintenance)}</div>
        </CardContent>
      </Card>

      {/* Rusak */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Rusak</span>
            <AlertTriangle size={14} className="text-semantic-danger" />
          </div>
          <div className="text-xl font-bold text-semantic-danger tracking-tight">{formatNumber(rusak)}</div>
        </CardContent>
      </Card>

      {/* Hilang */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Hilang</span>
            <AlertTriangle size={14} className="text-semantic-danger" />
          </div>
          <div className="text-xl font-bold text-semantic-danger tracking-tight">{formatNumber(hilang)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
