// src/features/dashboard/compositions/DashboardOverview.tsx
// Dashboard overview composition — composes individual KPI cards and widgets
// Constitution: Composition layer combines widgets; receives data via props or query

import { KasSummaryCard } from '../components/KasSummaryCard';
import { AbsensiSummaryCard } from '../components/AbsensiSummaryCard';
import { AlatStatusCard } from '../components/AlatStatusCard';
import { GradeDistributionCard } from '../components/GradeDistributionCard';
import { StudentPersonalDashboard } from '../components/StudentPersonalDashboard';
import type { DashboardSummaryData } from '../types/dashboard.types';

interface DashboardOverviewProps {
  data?: DashboardSummaryData;
  isStudentRole?: boolean;
}

export function DashboardOverview({ data, isStudentRole }: DashboardOverviewProps) {
  if (data?.scope === 'personal' || isStudentRole) {
    return <StudentPersonalDashboard data={data?.studentPersonal} />;
  }

  return (
    <div className="space-y-6">
      {/* Three primary widgets first; the distribution widget gets a readable full row. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KasSummaryCard data={data?.kas} />
        <AbsensiSummaryCard data={data?.absensi} />
        <AlatStatusCard data={data?.alat} />
        {data?.gradeDistribution && (
          <div className="md:col-span-2 lg:col-span-3">
            <GradeDistributionCard data={data.gradeDistribution} />
          </div>
        )}
      </div>

    </div>
  );
}
