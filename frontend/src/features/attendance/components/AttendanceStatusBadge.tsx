import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge';
import { formatStatusLabel } from '@/shared/utils/formatLabels';

const attendanceStatusMap: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  hadir: { label: 'Hadir', variant: 'success' },
  sakit: { label: 'Sakit', variant: 'warning' },
  izin: { label: 'Izin', variant: 'warning' },
  alpha: { label: 'Alpha', variant: 'danger' },
};

export function AttendanceStatusBadge({ status }: { status: string }) {
  const config = attendanceStatusMap[status] ?? {
    label: formatStatusLabel(status),
    variant: 'neutral' as const,
  };
  return <StatusBadge label={config.label} variant={config.variant} />;
}