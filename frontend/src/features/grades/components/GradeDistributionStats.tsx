// src/features/grades/components/GradeDistributionStats.tsx
// Summary cards for grade distribution A-E

import { GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { StudentGrade } from '../types/grades.types';

interface GradeDistributionStatsProps {
  grades: StudentGrade[];
}

export function GradeDistributionStats({ grades }: GradeDistributionStatsProps) {
  const total = grades.length;
  const countA = grades.filter((g) => g.nilai === 'A').length;
  const countB = grades.filter((g) => g.nilai === 'B').length;
  const countC = grades.filter((g) => g.nilai === 'C').length;
  const countD = grades.filter((g) => g.nilai === 'D').length;
  const countE = grades.filter((g) => g.nilai === 'E').length;

  const items = [
    { label: 'Predikat A', count: countA, textColor: 'text-semantic-success', barColor: 'bg-semantic-success' },
    { label: 'Predikat B', count: countB, textColor: 'text-primary', barColor: 'bg-primary' },
    { label: 'Predikat C', count: countC, textColor: 'text-semantic-warning', barColor: 'bg-semantic-warning' },
    { label: 'Predikat D', count: countD, textColor: 'text-semantic-warning', barColor: 'bg-semantic-warning' },
    { label: 'Predikat E', count: countE, textColor: 'text-semantic-danger', barColor: 'bg-semantic-danger' },
  ];

  return (
    <Card className="border-hairline bg-surface-1 shadow-none">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Sebaran Nilai Universal</p>
            <p className="mt-0.5 text-xs text-ink-subtle">Distribusi seluruh penilaian yang terdaftar.</p>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            <GraduationCap size={16} className="text-primary" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 border-b border-hairline pb-3">
          <span className="text-2xl font-bold tracking-tight text-ink">{formatNumber(total)}</span>
          <span className="text-sm text-ink-subtle">Penilaian terdaftar</span>
        </div>

        <div className="space-y-3" aria-label="Distribusi nilai A sampai E">
          {items.map((item) => {
            const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;

            return (
              <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span className={`flex size-8 items-center justify-center rounded-md bg-surface-2 text-xs font-bold ${item.textColor}`}>
                  {item.label.replace('Predikat ', '')}
                </span>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-ink-subtle">{item.label}</span>
                    <span className="shrink-0 font-medium text-ink">{formatNumber(item.count)}</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-label={`Proporsi ${item.label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                  >
                    <div className={`h-full rounded-full ${item.barColor}`} style={{ width: `${percentage}%` }} />
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
