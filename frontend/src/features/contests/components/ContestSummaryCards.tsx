// src/features/contests/components/ContestSummaryCards.tsx
// Summary cards for film contests & achievements metrics

import { Trophy, Film, Award, Flame } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/primitives/card';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { ContestSummary } from '../types/contests.types';

interface ContestSummaryCardsProps {
  summary?: ContestSummary;
}

export function ContestSummaryCards({ summary }: ContestSummaryCardsProps) {
  const totalLomba = summary?.totalLomba ?? 0;
  const lombaAktif = summary?.lombaAktif ?? 0;
  const totalKaryaSubmitted = summary?.totalKaryaSubmitted ?? 0;
  const totalPrestasiJuara = summary?.totalPrestasiJuara ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Total Contests */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Total Festival / Lomba</span>
            <Trophy size={14} className="text-primary" />
          </div>
          <div className="text-xl font-bold text-ink tracking-tight">{formatNumber(totalLomba)} Event</div>
        </CardContent>
      </Card>

      {/* Active Open Contests */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Lomba Aktif (Buka)</span>
            <Flame size={14} className="text-semantic-warning" />
          </div>
          <div className="text-xl font-bold text-semantic-warning tracking-tight">{formatNumber(lombaAktif)} Event</div>
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Total Karya Film Terdaftar</span>
            <Film size={14} className="text-primary" />
          </div>
          <div className="text-xl font-bold text-primary tracking-tight">{formatNumber(totalKaryaSubmitted)} Karya</div>
        </CardContent>
      </Card>

      {/* Trophies Won */}
      <Card className="bg-surface-1 border-hairline shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink-subtle text-[11px] font-medium">Total Prestasi Juara</span>
            <Award size={14} className="text-semantic-success" />
          </div>
          <div className="text-xl font-bold text-semantic-success tracking-tight">{formatNumber(totalPrestasiJuara)} Tropi / Sertifikat</div>
        </CardContent>
      </Card>
    </div>
  );
}
