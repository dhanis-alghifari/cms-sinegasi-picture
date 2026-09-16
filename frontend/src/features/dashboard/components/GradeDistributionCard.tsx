
import { GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { GradeDistributionSummary } from '../types/dashboard.types';

interface GradeDistributionCardProps {
  data?: GradeDistributionSummary;
}

export function GradeDistributionCard({ data }: GradeDistributionCardProps) {
  const dist = data?.distribution ?? { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const total = data?.totalSiswaEvaluated ?? 0;

  const grades = [
    { label: 'A', count: dist.A, color: 'bg-semantic-success', textColor: 'text-semantic-success' },
    { label: 'B', count: dist.B, color: 'bg-primary', textColor: 'text-primary' },
    { label: 'C', count: dist.C, color: 'bg-semantic-warning', textColor: 'text-semantic-warning' },
    { label: 'D', count: dist.D, color: 'bg-semantic-warning', textColor: 'text-semantic-warning' },
    { label: 'E', count: dist.E, color: 'bg-semantic-danger', textColor: 'text-semantic-danger' },
  ];

  return (
    <Card className="bg-surface-1 border-hairline shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-ink text-sm font-medium">Sebaran Nilai Universal (A–E)</CardTitle>
        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
          <GraduationCap size={16} className="text-primary" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-2xl font-bold text-ink tracking-tight">
            {formatNumber(total)} <span className="text-sm font-normal text-ink-subtle">Telah Dinilai</span>
          </div>
        </div>

        <div className="space-y-3" aria-label="Distribusi nilai A sampai E">
          {grades.map((item) => {
            const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;

            return (
              <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span className={`flex size-8 items-center justify-center rounded-md bg-surface-2 text-xs font-bold ${item.textColor}`}>
                  {item.label}
                </span>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-ink-subtle">Nilai {item.label}</span>
                    <span className="shrink-0 font-medium text-ink">{formatNumber(item.count)} siswa</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-label={`Proporsi nilai ${item.label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                  >
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 text-right text-xs font-semibold text-ink-subtle">{formatNumber(percentage)}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
