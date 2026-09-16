
import type { ElementType, ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ElementType;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
          <Icon size={22} className="text-ink-subtle" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      <h3 className="text-ink text-sm font-medium mb-1">{title}</h3>
      {description && <p className="text-ink-subtle text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
