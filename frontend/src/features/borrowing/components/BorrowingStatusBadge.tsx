import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge';
import { formatStatusLabel } from '@/shared/utils/formatLabels';

const borrowingStatusMap: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'warning' },
  approved: { label: 'Disetujui', variant: 'primary' },
  rejected: { label: 'Ditolak', variant: 'danger' },
  borrowed: { label: 'Dipinjam', variant: 'primary' },
  returned: { label: 'Dikembalikan', variant: 'success' },
  partial: { label: 'Sebagian', variant: 'warning' },
};

export function BorrowingStatusBadge({ status }: { status: string }) {
  const config = borrowingStatusMap[status] ?? {
    label: formatStatusLabel(status),
    variant: 'neutral' as const,
  };
  return <StatusBadge label={config.label} variant={config.variant} />;
}