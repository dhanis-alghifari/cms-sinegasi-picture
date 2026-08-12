// src/components/feedback/StatusBadge.tsx
// Shared status badge — maps string status to semantic colors
// Used by: equipment (condition/availability), attendance, borrowings, cash disputes

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatStatusLabel } from '@/shared/utils/formatLabels';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-semantic-success/15 text-semantic-success border-semantic-success/30',
  warning: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30',
  danger: 'bg-semantic-danger/15 text-semantic-danger border-semantic-danger/30',
  neutral: 'bg-surface-2 text-ink-muted border-hairline',
  primary: 'bg-primary/10 text-primary border-primary/30',
};

export function StatusBadge({ label, variant, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium px-2 py-0.5 rounded-full border',
        variantStyles[variant],
        className,
      )}
    >
      {label}
    </Badge>
  );
}

// ── Preset helpers ──────────────────────────────────────────

export function AttendanceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    hadir: { label: 'Hadir', variant: 'success' },
    sakit: { label: 'Sakit', variant: 'warning' },
    izin: { label: 'Izin', variant: 'warning' },
    alpha: { label: 'Alpha', variant: 'danger' },
  };
  const config = map[status] ?? { label: formatStatusLabel(status), variant: 'neutral' };
  return <StatusBadge label={config.label} variant={config.variant} />;
}

export function EquipmentConditionBadge({ condition }: { condition: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    bagus: { label: 'Bagus', variant: 'success' },
    sedikit_kerusakan: { label: 'Sedikit Rusak', variant: 'warning' },
    rusak: { label: 'Rusak', variant: 'danger' },
    rusak_besar: { label: 'Rusak Besar', variant: 'danger' },
    sedang_diperbaiki: { label: 'Diperbaiki', variant: 'warning' },
    hilang: { label: 'Hilang', variant: 'danger' },
  };
  const config = map[condition] ?? { label: formatStatusLabel(condition), variant: 'neutral' };
  return <StatusBadge label={config.label} variant={config.variant} />;
}

export function AvailabilityBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    tersedia: { label: 'Tersedia', variant: 'success' },
    dipinjam: { label: 'Dipinjam', variant: 'primary' },
    maintenance: { label: 'Maintenance', variant: 'warning' },
  };
  const config = map[status] ?? { label: formatStatusLabel(status), variant: 'neutral' };
  return <StatusBadge label={config.label} variant={config.variant} />;
}

export function BorrowingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    pending: { label: 'Menunggu', variant: 'warning' },
    approved: { label: 'Disetujui', variant: 'primary' },
    rejected: { label: 'Ditolak', variant: 'danger' },
    borrowed: { label: 'Dipinjam', variant: 'primary' },
    returned: { label: 'Dikembalikan', variant: 'success' },
    partial: { label: 'Sebagian', variant: 'warning' },
  };
  const config = map[status] ?? { label: formatStatusLabel(status), variant: 'neutral' };
  return <StatusBadge label={config.label} variant={config.variant} />;
}
