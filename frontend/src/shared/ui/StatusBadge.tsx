
import { Badge } from '@/shared/ui/primitives/badge';
import { cn } from '@/shared/utils/cn';

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface StatusBadgeProps {
  label: string;
  variant: StatusBadgeVariant;
  className?: string;
}

const variantStyles: Record<StatusBadgeVariant, string> = {
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
