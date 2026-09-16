
import { PageHeader } from '@/shared/ui/PageHeader';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { Button } from '@/shared/ui/primitives/button';
import { RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/shared/api/errors';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDashboardQuery } from '../hooks/useDashboardQuery';
import { DashboardOverview } from '../components/DashboardOverview';
import { formatRoleLabel } from '@/shared/utils/formatLabels';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data, error, isLoading, refetch, isRefetching } = useDashboardQuery();

  const isPersonalDashboard = data?.scope === 'personal' || user?.role !== 'teacher';
  const dashboardContent = (() => {
    if (error) {
      return (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-semantic-danger/30 bg-semantic-danger/10 p-4 text-sm text-semantic-danger sm:flex-row sm:items-center sm:justify-between">
          <span>{getErrorMessage(error)}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="w-full border-semantic-danger/30 bg-surface-1 text-semantic-danger hover:bg-semantic-danger/10 sm:w-auto">
            Coba lagi
          </Button>
        </div>
      );
    }
    if (isLoading) return <PageLoader label="Memuat ringkasan dashboard..." />;
    return <DashboardOverview data={data} isStudentRole={isPersonalDashboard} />;
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title={`Selamat Datang, ${user?.nama ?? 'Pengguna'}`}
        subtitle={`${isPersonalDashboard ? 'Dashboard Pribadi' : 'Dashboard Operasional Guru'}: Peran: ${formatRoleLabel(user?.role, 'Anggota / Siswa')}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="w-full bg-surface-1 text-xs text-ink-subtle hover:bg-surface-2 hover:text-ink sm:w-auto"
          >
            <RefreshCw size={14} className={isRefetching ? 'animate-spin mr-1.5' : 'mr-1.5'} />
            Pembaruan
          </Button>
        }
      />

      {dashboardContent}
    </div>
  );
}
